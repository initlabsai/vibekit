/** Contract write tools: app calls via the compose engine, deploy on raw algosdk. */
import {
  bytesToBase64,
  composeOrExecute,
  defineTool,
  resolveAbiMethod,
  ToolError,
  writeResultSchema,
  type AnyTool,
  type ToolContext,
  type TxnSpec,
} from '@initlabs/vibekit-core'
import algosdk, { AtomicTransactionComposer } from 'algosdk'
import { z } from 'zod'
import { parseAppSpec, substituteTemplateParams } from './lib/app-spec.js'

const appCallParams = z.object({
  sender: z.string().describe('Sender address'),
  appId: z.number().describe('The application ID'),
  methodSignature: z
    .string()
    .optional()
    .describe('ARC-4 method signature, e.g. "hello(string)string". Alternative to appSpec+method.'),
  appSpec: z.string().optional().describe('Full ARC-56/32 app spec JSON string (with method)'),
  method: z.string().optional().describe('Method name to look up in appSpec'),
  args: z
    .array(z.any())
    .optional()
    .describe('Method args. Transaction-typed args as objects: {"type":"pay","receiver":"...","amount":1000}'),
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
    handler: async (ctx, args) => composeOrExecute(ctx, [{ ...args, type } as TxnSpec]),
  }) as AnyTool
}

const DEPLOY_DESCRIPTION = `Deploy a new smart contract instance from an ARC-56/ARC-32 app spec.
Bare create (omit method) for contracts without constructor args — most contracts.
ABI create (method + args) for contracts with a constructor (e.g. "createApplication").
Plain create only: no idempotent update semantics (deploy again = new app).
Returns the new application ID and address (execute mode), or the unsigned create transaction (compose mode).`

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

  const compile = async (teal: string): Promise<Uint8Array> => {
    const compiled = await ctx.algod.compile(new TextEncoder().encode(teal)).do()
    return base64ToBytesStrict(compiled.result)
  }
  const base64ToBytesStrict = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

  let approval = spec.approvalByteCode
  let clear = spec.clearByteCode
  if (!approval) {
    if (!spec.approvalTeal) {
      throw new ToolError('INVALID_APP_SPEC', 'App spec has no approval program source or bytecode')
    }
    approval = await compile(substituteTemplateParams(spec.approvalTeal, args.deployTimeParams))
  }
  if (!clear) {
    if (!spec.clearTeal) {
      throw new ToolError('INVALID_APP_SPEC', 'App spec has no clear program source or bytecode')
    }
    clear = await compile(substituteTemplateParams(spec.clearTeal, args.deployTimeParams))
  }

  const suggestedParams = await ctx.algod.getTransactionParams().do()
  const note = args.note ? new TextEncoder().encode(args.note) : undefined
  const extraPages = Math.min(3, Math.max(0, Math.ceil((approval.length + clear.length) / 2048) - 1))
  const schemaFields = {
    numGlobalInts: spec.schema.globalInts,
    numGlobalByteSlices: spec.schema.globalBytes,
    numLocalInts: spec.schema.localInts,
    numLocalByteSlices: spec.schema.localBytes,
  }

  const emptySigner = algosdk.makeEmptyTransactionSigner()
  const signer =
    ctx.mode === 'execute' && ctx.resolveSigner ? await ctx.resolveSigner(args.sender) : emptySigner
  if (ctx.mode === 'execute' && !ctx.resolveSigner) {
    throw new ToolError('NO_SIGNER', 'This deployment has no signer configured; use compose mode.')
  }

  const atc = new AtomicTransactionComposer()
  if (args.method) {
    const abiMethod = resolveAbiMethod({ appSpec: args.appSpec, method: args.method }, 0)
    atc.addMethodCall({
      appID: BigInt(0),
      method: abiMethod!,
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

export const contractWriteTools: AnyTool[] = [
  defineTool({
    name: 'app_deploy',
    description: DEPLOY_DESCRIPTION,
    parameters: z.object({
      sender: z.string().describe('Creator/sender address'),
      appSpec: z.string().describe('ARC-56 or ARC-32 app spec JSON as a string'),
      method: z.string().optional().describe('ABI create method name (omit for bare create)'),
      args: z.array(z.any()).optional().describe('Arguments for the ABI create method'),
      deployTimeParams: z
        .record(z.string(), z.union([z.string(), z.number()]))
        .optional()
        .describe('TMPL_* template substitutions applied to TEAL source before compiling'),
      note: z.string().optional().describe('Optional note'),
    }),
    output: z.union([
      z.object({
        appId: z.number(),
        appAddress: z.string(),
        txid: z.string(),
        confirmedRound: z.number(),
        return: z.unknown().optional(),
      }),
      z.object({ unsignedGroup: z.array(z.string()), summary: z.string() }),
    ]),
    requiresSigner: true,
    view: 'txn',
    handler: async (ctx, args) => deployApp(ctx, args),
  }) as AnyTool,
  appTool('app_call', 'app_call', 'Call a smart contract method (or bare NoOp).'),
  appTool('app_opt_in', 'app_opt_in', 'Opt the sender into an application (allocates local state).'),
  appTool('app_close_out', 'app_close_out', 'Close the sender out of an application (graceful local-state exit).'),
  appTool('app_delete', 'app_delete', 'Delete an application (sender must be authorized by the contract).'),
]
