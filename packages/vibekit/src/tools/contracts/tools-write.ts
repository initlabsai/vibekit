/** Contract write tools: app calls via the compose engine, deploy on raw algosdk. */
import {
  bytesToBase64,
  composeOrExecute,
  defineTool,
  ToolError,
  writeResultSchema,
  type AnyTool,
  type ToolContext,
  type TxnSpec,
} from '../../core/index.js'
import algosdk, { AtomicTransactionComposer } from 'algosdk'
import { z } from 'zod'
import {
  appSpecParams,
  parseAppSpec,
  requireAppSpec,
  substituteTemplateParams,
  withAppSpecFile,
  type ParsedMethod,
} from './app-spec.js'

/** The ABI method a normalized spec declares under `name`; no second parse of the spec. */
function abiMethodFromSpec(spec: { methods: ParsedMethod[] }, name: string): algosdk.ABIMethod {
  const method = spec.methods.find((candidate) => candidate.name === name)
  if (!method) throw new ToolError('METHOD_NOT_FOUND', `Method "${name}" not found in app spec`)
  return algosdk.ABIMethod.fromSignature(method.signature)
}

const appCallParams = z.object({
  sender: z.string().describe('Sender address'),
  appId: z.number().describe('The application ID'),
  methodSignature: z
    .string()
    .optional()
    .describe('ARC-4 method signature, e.g. "hello(string)string". Alternative to appSpec+method.'),
  ...appSpecParams,
  method: z.string().optional().describe('Method name to look up in the app spec'),
  args: z
    .array(z.any())
    .optional()
    .describe(
      'Method args. Transaction-typed args as objects: {"type":"pay","receiver":"...","amount":1000}',
    ),
  extraFee: z.number().optional().describe('Extra fee in microALGO for inner transactions'),
  maxFee: z.number().optional().describe('Max fee in microALGO'),
  note: z.string().optional().describe('Optional note'),
})

function appTool(
  name: string,
  type: 'app_call' | 'app_opt_in' | 'app_close_out' | 'app_delete',
  description: string,
): AnyTool {
  return defineTool({
    name,
    description: `${description} Provide methodSignature OR appSpec+method for ABI calls; omit both for a bare call. In compose mode returns unsigned transactions for external signing.`,
    parameters: appCallParams,
    output: writeResultSchema,
    requiresSigner: true,
    view: 'txn',
    handler: async (ctx, args) =>
      composeOrExecute(ctx, [{ ...(await withAppSpecFile(args)), type } as TxnSpec]),
  }) as AnyTool
}

const DEPLOY_DESCRIPTION = `Deploy a new smart contract instance from an ARC-56/ARC-32 app spec.
Bare create (omit method) for contracts without constructor args — most contracts.
ABI create (method + args) for contracts with a constructor (e.g. "createApplication").
Plain create only: no idempotent update semantics (deploy again = new app).
Unless a note is given, the create txn carries the AlgoKit deployer note (ALGOKIT_DEPLOYER:j{"name":…}) so the Explorer and AlgoKit tooling recognise the deployment by contract name.
Pass appSpecPath — the built artifact (artifacts/<Name>.arc56.json). Paste appSpec JSON only if no file is available.
Returns the new application ID and address (execute mode), or the unsigned create transaction (compose mode).`

/** The note AlgoKit's deployer stamps on create txns; indexer note-prefix searches find deployments by name. */
export const DEPLOYER_NOTE_PREFIX = 'ALGOKIT_DEPLOYER:j'

/** AlgoKit-compatible deployer note for a named contract; undefined for an unnamed spec. */
export function deployerNote(name: string | undefined): string | undefined {
  return name ? `${DEPLOYER_NOTE_PREFIX}${JSON.stringify({ name, version: '1.0' })}` : undefined
}

/** Approval/clear bytecode from the spec: precompiled if present, else TEAL with TMPL_* substituted. */
async function compilePrograms(
  ctx: ToolContext,
  spec: ReturnType<typeof parseAppSpec>,
  deployTimeParams?: Record<string, string | number>,
): Promise<{ approval: Uint8Array; clear: Uint8Array }> {
  const compile = async (teal: string): Promise<Uint8Array> => {
    const compiled = await ctx.algod.compile(new TextEncoder().encode(teal)).do()
    return Uint8Array.from(atob(compiled.result), (c) => c.charCodeAt(0))
  }
  const program = async (kind: 'approval' | 'clear'): Promise<Uint8Array> => {
    const bytes = kind === 'approval' ? spec.approvalByteCode : spec.clearByteCode
    if (bytes) return bytes
    const teal = kind === 'approval' ? spec.approvalTeal : spec.clearTeal
    if (!teal)
      throw new ToolError('INVALID_APP_SPEC', `App spec has no ${kind} program source or bytecode`)
    return compile(substituteTemplateParams(teal, deployTimeParams))
  }
  return { approval: await program('approval'), clear: await program('clear') }
}

async function signerFor(ctx: ToolContext, sender: string): Promise<algosdk.TransactionSigner> {
  if (ctx.mode !== 'execute') return algosdk.makeEmptyTransactionSigner()
  if (!ctx.resolveSigner) {
    throw new ToolError('NO_SIGNER', 'This deployment has no signer configured; use compose mode.')
  }
  return ctx.resolveSigner(sender)
}

async function updateApp(
  ctx: ToolContext,
  args: {
    sender: string
    appId: number
    appSpec: string
    method?: string
    args?: unknown[]
    deployTimeParams?: Record<string, string | number>
    note?: string
  },
) {
  if (!algosdk.isValidAddress(args.sender)) {
    throw new ToolError('INVALID_ADDRESS', `Invalid sender address: ${args.sender}`)
  }
  const spec = parseAppSpec(args.appSpec)
  const { approval, clear } = await compilePrograms(ctx, spec, args.deployTimeParams)
  const suggestedParams = await ctx.algod.getTransactionParams().do()
  const note = args.note ? new TextEncoder().encode(args.note) : undefined
  const signer = await signerFor(ctx, args.sender)
  const appID = BigInt(args.appId)

  const atc = new AtomicTransactionComposer()
  if (args.method) {
    atc.addMethodCall({
      appID,
      method: abiMethodFromSpec(spec, args.method),
      methodArgs: (args.args ?? []) as algosdk.ABIArgument[],
      sender: args.sender,
      signer,
      onComplete: algosdk.OnApplicationComplete.UpdateApplicationOC,
      approvalProgram: approval,
      clearProgram: clear,
      note,
      suggestedParams,
    })
  } else {
    const txn = algosdk.makeApplicationUpdateTxnFromObject({
      sender: args.sender,
      appIndex: appID,
      approvalProgram: approval,
      clearProgram: clear,
      note,
      suggestedParams,
    })
    atc.addTransaction({ txn, signer })
  }

  if (ctx.mode === 'compose') {
    const group = atc.buildGroup()
    return {
      unsignedGroup: group.map((t) => bytesToBase64(algosdk.encodeUnsignedTransaction(t.txn))),
      summary: `update app ${args.appId} to "${spec.name ?? 'unnamed'}"${args.method ? ` via ${args.method}` : ' (bare)'}`,
    }
  }

  const result = await atc.execute(ctx.algod, 4)
  return {
    appId: args.appId,
    txid: result.txIDs[0]!,
    confirmedRound: Number(result.confirmedRound),
    return: result.methodResults[0]?.returnValue ?? undefined,
  }
}

/** Wire shape of app_update results: executed update, or unsigned group in compose mode. */
export const appUpdateResultSchema = z.union([
  z.object({
    appId: z.number(),
    txid: z.string(),
    confirmedRound: z.number(),
    return: z.unknown().optional(),
  }),
  z.object({ unsignedGroup: z.array(z.string()), summary: z.string() }),
])

const UPDATE_DESCRIPTION = `Replace an existing application's approval and clear programs from a rebuilt ARC-56/ARC-32 app spec. The app ID, address, state, and boxes stay; only the code changes.
The contract must allow UpdateApplication: a bare update (omit method) when it declares a bare update handler, or an ABI update method (method + args).
Global/local state schema cannot change on update — a schema change needs app_deploy (a new app).
Pass appSpecPath — the rebuilt artifact (artifacts/<Name>.arc56.json).
Returns the txid (execute mode), or the unsigned update transaction (compose mode).`

async function deployApp(
  ctx: ToolContext,
  args: {
    sender: string
    appSpec: string
    method?: string
    args?: unknown[]
    deployTimeParams?: Record<string, string | number>
    note?: string
  },
) {
  if (!algosdk.isValidAddress(args.sender)) {
    throw new ToolError('INVALID_ADDRESS', `Invalid sender address: ${args.sender}`)
  }
  const spec = parseAppSpec(args.appSpec)
  const { approval, clear } = await compilePrograms(ctx, spec, args.deployTimeParams)

  const suggestedParams = await ctx.algod.getTransactionParams().do()
  const noteText = args.note ?? deployerNote(spec.name)
  const note = noteText ? new TextEncoder().encode(noteText) : undefined
  const extraPages = Math.min(
    3,
    Math.max(0, Math.ceil((approval.length + clear.length) / 2048) - 1),
  )
  const schemaFields = {
    numGlobalInts: spec.schema.globalInts,
    numGlobalByteSlices: spec.schema.globalBytes,
    numLocalInts: spec.schema.localInts,
    numLocalByteSlices: spec.schema.localBytes,
  }
  const signer = await signerFor(ctx, args.sender)

  const atc = new AtomicTransactionComposer()
  if (args.method) {
    atc.addMethodCall({
      appID: BigInt(0),
      method: abiMethodFromSpec(spec, args.method),
      methodArgs: (args.args ?? []) as algosdk.ABIArgument[],
      sender: args.sender,
      signer,
      approvalProgram: approval,
      clearProgram: clear,
      extraPages,
      ...schemaFields,
      note,
      suggestedParams,
    })
  } else {
    const txn = algosdk.makeApplicationCreateTxnFromObject({
      sender: args.sender,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      approvalProgram: approval,
      clearProgram: clear,
      extraPages,
      ...schemaFields,
      note,
      suggestedParams,
    })
    atc.addTransaction({ txn, signer })
  }

  if (ctx.mode === 'compose') {
    const group = atc.buildGroup()
    return {
      unsignedGroup: group.map((t) => bytesToBase64(algosdk.encodeUnsignedTransaction(t.txn))),
      summary: `create app "${spec.name ?? 'unnamed'}"${args.method ? ` via ${args.method}` : ' (bare)'}`,
    }
  }

  const result = await atc.execute(ctx.algod, 4)
  const txid = result.txIDs[0]!
  const pending = await ctx.algod.pendingTransactionInformation(txid).do()
  const appId = Number(pending.applicationIndex ?? 0)
  return {
    appId,
    appAddress: String(algosdk.getApplicationAddress(BigInt(appId))),
    txid,
    confirmedRound: Number(result.confirmedRound),
    return: result.methodResults[0]?.returnValue ?? undefined,
  }
}

/** Wire shape of app_deploy results: executed deployment, or unsigned group in compose mode. */
export const appDeployResultSchema = z.union([
  z.object({
    appId: z.number(),
    appAddress: z.string(),
    txid: z.string(),
    confirmedRound: z.number(),
    return: z.unknown().optional(),
  }),
  z.object({ unsignedGroup: z.array(z.string()), summary: z.string() }),
])

export const contractWriteTools: AnyTool[] = [
  defineTool({
    name: 'app_deploy',
    description: DEPLOY_DESCRIPTION,
    parameters: z.object({
      sender: z.string().describe('Creator/sender address'),
      ...appSpecParams,
      method: z.string().optional().describe('ABI create method name (omit for bare create)'),
      args: z.array(z.any()).optional().describe('Arguments for the ABI create method'),
      deployTimeParams: z
        .record(z.string(), z.union([z.string(), z.number()]))
        .optional()
        .describe('TMPL_* template substitutions applied to TEAL source before compiling'),
      note: z
        .string()
        .optional()
        .describe('Optional note (default: the AlgoKit deployer note for the contract name)'),
    }),
    output: appDeployResultSchema,
    requiresSigner: true,
    view: 'txn',
    handler: async (ctx, args) => {
      const resolved = await withAppSpecFile(args)
      return deployApp(ctx, { ...resolved, appSpec: requireAppSpec(resolved) })
    },
  }) as AnyTool,
  defineTool({
    name: 'app_update',
    description: UPDATE_DESCRIPTION,
    parameters: z.object({
      sender: z.string().describe('Sender address (must be authorized to update by the contract)'),
      appId: z.number().describe('The application ID to update'),
      ...appSpecParams,
      method: z.string().optional().describe('ABI update method name (omit for a bare update)'),
      args: z.array(z.any()).optional().describe('Arguments for the ABI update method'),
      deployTimeParams: z
        .record(z.string(), z.union([z.string(), z.number()]))
        .optional()
        .describe('TMPL_* template substitutions applied to TEAL source before compiling'),
      note: z.string().optional().describe('Optional note'),
    }),
    output: appUpdateResultSchema,
    requiresSigner: true,
    view: 'txn',
    handler: async (ctx, args) => {
      const resolved = await withAppSpecFile(args)
      return updateApp(ctx, { ...resolved, appSpec: requireAppSpec(resolved) })
    },
  }) as AnyTool,
  appTool('app_call', 'app_call', 'Call a smart contract method (or bare NoOp).'),
  appTool(
    'app_opt_in',
    'app_opt_in',
    'Opt the sender into an application (allocates local state).',
  ),
  appTool(
    'app_close_out',
    'app_close_out',
    'Close the sender out of an application (graceful local-state exit).',
  ),
  appTool(
    'app_delete',
    'app_delete',
    'Delete an application (sender must be authorized by the contract).',
  ),
]
