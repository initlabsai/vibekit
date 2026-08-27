/**
 * Runtime ToolDefinition[] from an ARC-56 (or normalized ARC-32/4) spec.
 * Each ABI method becomes a typed tool. Readonly methods
 * simulate without a signer; writes go through composeOrExecute.
 */
import {
  composeOrExecute,
  defineTool,
  simulateGroup,
  writeResultSchema,
  type AnyTool,
  type TxnSpec,
} from '../../../core/index.js'
import algosdk from 'algosdk'
import { z } from 'zod'

import { encodeMethodArgs, methodFromParsed, zodForAbiType } from './abi.js'
import { normalizeAppSpec, type NormalizedAppSpec, type ParsedMethod } from './app-spec.js'

const RESERVED_PARAM_NAMES = new Set(['sender', 'appId', 'extraFee', 'note', 'network'])

/** Wire shape of a generated readonly-method call (simulateGroup, jsonSafe). */
export const arc56SimulateResultSchema = z.object({
  wouldSucceed: z.boolean(),
  failureMessage: z.string().optional(),
  failedAt: z.array(z.number()).optional(),
  simulatedRound: z.number(),
  txids: z.array(z.string()),
  transactionResults: z.array(
    z.object({
      txid: z.string(),
      logs: z.array(z.string()).optional(),
      budgetConsumed: z.number().optional(),
    }),
  ),
  returns: z.array(z.object({ index: z.number(), value: z.unknown().nullish() })),
  appBudgetAdded: z.number().optional(),
  appBudgetConsumed: z.number().optional(),
})

export interface ToolsFromArc56Options {
  /**
   * Bind generated tools to a deployed app. When omitted, each tool takes
   * `appId` as a required parameter.
   */
  appId?: number
}

function slug(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return cleaned.length > 0 ? cleaned : 'app'
}

function argParamName(arg: ParsedMethod['args'][number], index: number, used: Set<string>): string {
  const raw = arg.name && arg.name.length > 0 ? arg.name : `arg${index}`
  let candidate = slug(raw) || `arg${index}`
  if (RESERVED_PARAM_NAMES.has(candidate) || used.has(candidate)) candidate = `arg_${candidate}`
  let unique = candidate
  let n = 2
  while (used.has(unique)) {
    unique = `${candidate}_${n}`
    n += 1
  }
  used.add(unique)
  return unique
}

function methodParameters(method: ParsedMethod, bindAppId: number | undefined, readonly = false) {
  const used = new Set<string>()
  const shape: Record<string, z.ZodType> = {
    sender: z.string().describe('Sender address (required even for simulate)'),
  }
  if (bindAppId === undefined) {
    shape.appId = z.number().int().nonnegative().describe('Deployed application ID')
  }
  for (let i = 0; i < method.args.length; i++) {
    const arg = method.args[i]!
    const name = argParamName(arg, i, used)
    const schema = zodForAbiType(arg.type)
    shape[name] = arg.description ? schema.describe(arg.description) : schema
  }
  shape.extraFee = z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Extra fee in microALGO for inner transactions')
  if (!readonly) {
    shape.fundAppMicroAlgos = z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'Pay this many microALGO from sender to the app account in the same group, before the call — for box or state writes the app must fund (a simulate saying "balance N below min M" for the app address).',
      )
  }
  shape.note = z.string().optional().describe('Optional note')
  return z.object(shape)
}

function namedArgsFromTool(
  method: ParsedMethod,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const used = new Set<string>()
  const named: Record<string, unknown> = {}
  for (let i = 0; i < method.args.length; i++) {
    const arg = method.args[i]!
    const name = argParamName(arg, i, used)
    named[arg.name && arg.name.length > 0 ? arg.name : `arg${i}`] = args[name]
  }
  return named
}

function uniqueToolName(prefix: string, method: ParsedMethod, taken: Set<string>): string {
  const base = `${prefix}_${slug(method.name)}`
  let name = base
  let n = 2
  while (taken.has(name)) {
    name = `${base}_${n}`
    n += 1
  }
  taken.add(name)
  return name
}

function toolForMethod(
  spec: NormalizedAppSpec,
  method: ParsedMethod,
  options: ToolsFromArc56Options,
  taken: Set<string>,
): AnyTool {
  const prefix = slug(spec.name)
  const name = uniqueToolName(prefix, method, taken)
  const readonly = method.readonly === true
  const bindAppId = options.appId
  const parameters = methodParameters(method, bindAppId, readonly)
  const signature = method.signature
  // Validate the signature up front so a bad spec fails at generation, not first call.
  methodFromParsed(method)

  const description = [
    readonly ? 'Simulate (read-only, no signatures).' : 'Compose or execute an application call.',
    `${spec.name}.${signature}`,
    method.description,
  ]
    .filter(Boolean)
    .join(' ')

  return defineTool({
    name,
    description,
    parameters,
    output: readonly ? arc56SimulateResultSchema : writeResultSchema,
    ...(readonly ? {} : { requiresSigner: true }),
    view: readonly ? 'json' : 'txn',
    handler: async (ctx, args) => {
      const record = args as Record<string, unknown>
      const appId = bindAppId ?? (record.appId as number)
      const methodArgs = encodeMethodArgs(method, namedArgsFromTool(method, record))
      const specTxn: TxnSpec = {
        type: 'app_call',
        sender: record.sender as string,
        appId,
        methodSignature: signature,
        args: methodArgs,
        extraFee: record.extraFee as number | undefined,
        note: record.note as string | undefined,
      }
      if (readonly) return simulateGroup(ctx, [specTxn])
      const fund = record.fundAppMicroAlgos as number | undefined
      const specs: TxnSpec[] = fund
        ? [
            {
              type: 'payment',
              sender: record.sender as string,
              receiver: algosdk.getApplicationAddress(BigInt(appId)).toString(),
              amountMicroAlgos: fund,
            },
            specTxn,
          ]
        : [specTxn]
      const result = await composeOrExecute(ctx, specs)
      // The approval card reads this line: name the call and its args, not the txn shape.
      return 'summary' in result
        ? {
            ...result,
            summary: describeCall(spec, method, appId, namedArgsFromTool(method, record), fund),
          }
        : result
    },
  }) as AnyTool
}

/** `HiWorld.hi(name: "gabe") → app 1018`, for the approval card. */
export function describeCall(
  spec: NormalizedAppSpec,
  method: ParsedMethod,
  appId: number,
  named: Record<string, unknown>,
  fundAppMicroAlgos?: number,
): string {
  const args = method.args
    .map((arg, index) => {
      const key = arg.name && arg.name.length > 0 ? arg.name : `arg${index}`
      return `${key}: ${JSON.stringify(named[key])}`
    })
    .join(', ')
  const fund = fundAppMicroAlgos ? ` · funds app ${fundAppMicroAlgos} µALGO` : ''
  return `${spec.name}.${method.name}(${args}) → app ${appId}${fund}`
}

/** A generated tool paired with the spec method it calls. */
export interface GeneratedAppTool {
  tool: AnyTool
  method: ParsedMethod
}

/**
 * Generated tools paired with their methods. Callers that need to invoke a
 * specific method must pair this way: tool names are slugged and
 * deduplicated, so neither the method name nor its signature can be
 * recovered from the tool alone.
 */
export function toolsWithMethods(
  spec: string | NormalizedAppSpec,
  options: ToolsFromArc56Options = {},
): GeneratedAppTool[] {
  const normalized = typeof spec === 'string' ? normalizeAppSpec(spec) : spec
  const taken = new Set<string>()
  return normalized.methods.map((method) => ({
    method,
    tool: toolForMethod(normalized, method, options, taken),
  }))
}

/**
 * Turn an app spec into one ToolDefinition per ABI method. Pass a JSON string
 * or an already-normalized spec. Bind `appId` when the deployment is known
 * (My Apps associations); otherwise each tool takes `appId` as a parameter.
 */
export function toolsFromArc56(
  spec: string | NormalizedAppSpec,
  options: ToolsFromArc56Options = {},
): AnyTool[] {
  return toolsWithMethods(spec, options).map((entry) => entry.tool)
}

/**
 * Map arguments keyed by their ABI names onto the generated tool's parameter
 * names. Parameters are slugged (`userName` becomes `username`) and may be
 * prefixed to dodge reserved names, so spec-named arguments never reach the
 * handler intact.
 */
export function toolArgsFor(
  method: ParsedMethod,
  namedBySpecName: Record<string, unknown>,
): Record<string, unknown> {
  const used = new Set<string>()
  const mapped: Record<string, unknown> = {}
  method.args.forEach((arg, index) => {
    const param = argParamName(arg, index, used)
    const specKey = arg.name && arg.name.length > 0 ? arg.name : `arg${index}`
    if (specKey in namedBySpecName) mapped[param] = namedBySpecName[specKey]
  })
  return mapped
}
