/**
 * ABI type forms, encoding, and recorded-call decoding for ARC-56 tools.
 * Plain algosdk (ABIMethod, ABIType) — no generated clients.
 */
import { base64ToBytes, bytesToBase64, jsonSafe, ToolError } from '@initlabs/vibekit-core'
import { ABIMethod, ABIType, Address } from 'algosdk'
import { z } from 'zod'

import type { NormalizedAppSpec, ParsedMethod } from './app-spec.js'

/** ARC-4 ABI return log prefix `0x151f7c75`. */
const ABI_RETURN_PREFIX = new Uint8Array([0x15, 0x1f, 0x7c, 0x75])

const TXN_ARG_TYPES = new Set(['pay', 'axfer', 'acfg', 'afrz', 'appl', 'keyreg', 'txn'])
const REF_ARG_TYPES = new Set(['account', 'application', 'asset'])

/** A named, JSON-safe decoded ABI value. */
export interface DecodedAbiValue {
  name?: string
  type: string
  value?: unknown
}

/** Method identity plus decoded args/return for a recorded or simulated call. */
export interface DecodedAppCall {
  methodName: string
  signature: string
  args: DecodedAbiValue[]
  returnValue?: unknown
}

/**
 * JSON-shape schema for one ABI argument as a generated-tool parameter.
 * Transaction-typed args keep the compose engine's object form; byte values
 * travel as base64; uints wider than 64 bits as decimal strings.
 */
export function zodForAbiType(type: string): z.ZodType {
  if (TXN_ARG_TYPES.has(type)) {
    return z
      .object({
        type: z.enum(['pay', 'axfer', 'acfg', 'afrz']),
        sender: z.string().optional(),
        receiver: z.string().optional(),
        amount: z.number().optional(),
        assetId: z.number().optional(),
        note: z.string().optional(),
      })
      .passthrough()
  }
  if (type === 'account' || type === 'address') return z.string()
  if (type === 'application' || type === 'asset') return z.number().int().nonnegative()
  if (type === 'bool') return z.boolean()
  if (type === 'string') return z.string()
  if (type === 'byte' || type === 'byte[]' || /^byte\[\d+]$/.test(type)) return z.string()
  if (/^uint(\d+)$/.test(type)) {
    const bits = Number(/^uint(\d+)$/.exec(type)![1])
    return bits <= 64 ? z.union([z.number(), z.string()]) : z.string()
  }
  if (type.endsWith('[]')) return z.array(zodForAbiType(type.slice(0, -2)))
  // Tuples and anything ABIType.parse understands: accept JSON and let encode reject.
  return z.unknown()
}

/** Convert a JSON tool argument into the value algosdk's ABIType.encode accepts. */
export function jsonToAbiValue(type: string, value: unknown): unknown {
  if (TXN_ARG_TYPES.has(type) || REF_ARG_TYPES.has(type)) return value
  if (value === undefined || value === null) return value
  if (type === 'address' || type === 'account') return value
  if (type === 'bool' || type === 'string') return value
  if (type === 'byte' || type === 'byte[]' || /^byte\[\d+]$/.test(type)) {
    if (typeof value !== 'string') return value
    try {
      return base64ToBytes(value)
    } catch {
      return new TextEncoder().encode(value)
    }
  }
  if (/^uint(\d+)$/.test(type)) {
    if (typeof value === 'string') return BigInt(value)
    return value
  }
  if (type.endsWith('[]') && Array.isArray(value)) {
    const inner = type.slice(0, -2)
    return value.map((entry) => jsonToAbiValue(inner, entry))
  }
  return value
}

function abiValueToJson(value: unknown): unknown {
  if (value instanceof Address) return value.toString()
  if (value instanceof Uint8Array) return bytesToBase64(value)
  if (typeof value === 'bigint') return jsonSafe(value)
  if (Array.isArray(value)) return value.map(abiValueToJson)
  return jsonSafe(value)
}

export function methodFromParsed(method: ParsedMethod): ABIMethod {
  try {
    return ABIMethod.fromSignature(method.signature)
  } catch (error) {
    throw new ToolError(
      'INVALID_ABI',
      `Cannot parse ABI signature "${method.signature}": ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function selectorsEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return false
  return true
}

function decodeReturnFromLogs(method: ABIMethod, logs: readonly string[] | undefined): unknown {
  if (method.returns.type === 'void' || !logs || logs.length === 0) return undefined
  const last = base64ToBytes(logs[logs.length - 1]!)
  if (last.length < 4 || !selectorsEqual(last.slice(0, 4), ABI_RETURN_PREFIX)) return undefined
  if (typeof method.returns.type === 'string') return undefined
  return abiValueToJson(method.returns.type.decode(last.slice(4)))
}

/**
 * Match a recorded application call against a spec: selector → method name,
 * remaining application-args → named values, last ABI-prefixed log → return.
 * Undefined when the selector matches no spec method (bare call, unknown app).
 */
export function decodeAppCall(
  spec: Pick<NormalizedAppSpec, 'methods'>,
  applicationArgs: readonly string[] | undefined,
  logs?: readonly string[],
): DecodedAppCall | undefined {
  if (!applicationArgs || applicationArgs.length === 0) return undefined
  let selector: Uint8Array
  try {
    selector = base64ToBytes(applicationArgs[0]!)
  } catch {
    return undefined
  }
  if (selector.length !== 4) return undefined

  for (const parsed of spec.methods) {
    let method: ABIMethod
    try {
      method = methodFromParsed(parsed)
    } catch {
      continue
    }
    if (!selectorsEqual(method.getSelector(), selector)) continue

    // fromSignature drops arg names; names come from the spec's ParsedMethod.
    const valueArgs = parsed.args.filter((arg) => !TXN_ARG_TYPES.has(arg.type))
    const encoded = applicationArgs.slice(1)
    const args: DecodedAbiValue[] = []
    for (let i = 0; i < valueArgs.length; i++) {
      const parsedArg = valueArgs[i]!
      const raw = encoded[i]
      const entry = (value: unknown): DecodedAbiValue => ({
        ...(parsedArg.name ? { name: parsedArg.name } : {}),
        type: parsedArg.type,
        value,
      })
      if (raw === undefined) {
        args.push(entry(undefined))
        continue
      }
      if (REF_ARG_TYPES.has(parsedArg.type)) {
        const bytes = base64ToBytes(raw)
        args.push(entry(bytes.length === 1 ? bytes[0] : raw))
        continue
      }
      try {
        args.push(entry(abiValueToJson(ABIType.from(parsedArg.type).decode(base64ToBytes(raw)))))
      } catch {
        args.push(entry(raw))
      }
    }
    return {
      methodName: method.name,
      signature: method.getSignature(),
      args,
      returnValue: decodeReturnFromLogs(method, logs),
    }
  }
  return undefined
}

/** Decode using a My Apps catalog keyed by deployed application id. */
export function decodeAppCallForApp(
  specs: ReadonlyMap<number, Pick<NormalizedAppSpec, 'methods'>>,
  applicationId: number | undefined,
  applicationArgs: readonly string[] | undefined,
  logs?: readonly string[],
): DecodedAppCall | undefined {
  if (applicationId === undefined) return undefined
  const spec = specs.get(applicationId)
  if (!spec) return undefined
  return decodeAppCall(spec, applicationArgs, logs)
}

type AppCallTxn = {
  applicationId?: number
  applicationArgs?: string[]
  logs?: string[]
  methodName?: string
  methodArgs?: DecodedAbiValue[]
  methodReturn?: unknown
  innerTxns?: AppCallTxn[]
}

/**
 * Fill methodName / methodArgs / methodReturn on a formatted transaction tree
 * wherever the catalog has a spec for that applicationId. Mutates in place.
 */
export function enrichTransactionsWithAbi<T extends AppCallTxn>(
  transactions: T[],
  specs: ReadonlyMap<number, Pick<NormalizedAppSpec, 'methods'>>,
): T[] {
  const walk = (txn: AppCallTxn) => {
    const decoded = decodeAppCallForApp(specs, txn.applicationId, txn.applicationArgs, txn.logs)
    if (decoded) {
      txn.methodName = decoded.methodName
      if (decoded.args.length > 0) txn.methodArgs = decoded.args
      if (decoded.returnValue !== undefined) txn.methodReturn = decoded.returnValue
    }
    txn.innerTxns?.forEach(walk)
  }
  transactions.forEach(walk)
  return transactions
}

/** Look up a spec method by name; first match if overloaded. */
export function findParsedMethod(spec: Pick<NormalizedAppSpec, 'methods'>, name: string): ParsedMethod {
  const method = spec.methods.find((entry) => entry.name === name)
  if (!method) throw new ToolError('METHOD_NOT_FOUND', `Method "${name}" not found in app spec`)
  return method
}

/** Encode JSON args into the list ATC addMethodCall expects. Txn-typed slots pass through for core to build. */
export function encodeMethodArgs(method: ParsedMethod, named: Record<string, unknown>): unknown[] {
  return method.args.map((arg, index) => {
    const key = arg.name && arg.name.length > 0 ? arg.name : `arg${index}`
    const value = named[key]
    if (TXN_ARG_TYPES.has(arg.type)) return value
    if (value === undefined) {
      throw new ToolError('INVALID_ARGS', `Missing argument "${key}" for ${method.signature}`)
    }
    if (REF_ARG_TYPES.has(arg.type)) return value
    try {
      const prepared = jsonToAbiValue(arg.type, value)
      ABIType.from(arg.type).encode(prepared as never)
      return prepared
    } catch (error) {
      throw new ToolError(
        'INVALID_ARGS',
        `Argument "${key}" (${arg.type}): ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  })
}

export { ABIMethod }
