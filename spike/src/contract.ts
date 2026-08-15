/**
 * Spike version of the @initlabs/core tool contract (V2-DESIGN §4).
 * Deliberately minimal — just enough to validate the design end-to-end.
 */
import type algosdk from 'algosdk'
import type { z } from 'zod'

export type NetworkId = 'mainnet' | 'testnet' | 'localnet'

export type DisplayHint = 'table' | 'txn' | 'account' | 'asset' | 'markdown' | 'json'

export interface ToolContext {
  network: NetworkId
  algod: algosdk.Algodv2
  indexer: algosdk.Indexer
  /** 'execute' = sign & send via resolveSigner; 'compose' = return unsignedGroup. */
  mode: 'execute' | 'compose'
  resolveSigner?: (address: string) => Promise<algosdk.TransactionSigner>
  services: Record<string, unknown>
}

/** Write tools in compose mode return this instead of executing. */
export interface UnsignedGroupResult {
  unsignedGroup: string[] // base64-encoded unsigned transactions
  summary: string
}

export interface ToolDefinition<P extends z.ZodType = z.ZodType> {
  name: string
  description: string
  parameters: P
  output?: z.ZodType
  requiresSigner?: boolean
  display?: DisplayHint
  handler: (ctx: ToolContext, args: z.infer<P>) => Promise<unknown>
}

/** Identity helper so `parameters` inference flows into the handler's `args`. */
export function defineTool<P extends z.ZodType>(def: ToolDefinition<P>): ToolDefinition<P> {
  return def
}

/** Erased form for heterogeneous tool lists (registries, adapters). */
export type AnyTool = ToolDefinition<z.ZodType>

export class ToolError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ToolError'
  }
}

/**
 * The one place bigint/bytes become JSON-safe (V2-DESIGN §4: algosdk v3 emits
 * bigint everywhere; hosts must not each invent their own sanitizer).
 * bigint → number when safe, else string; Uint8Array → base64.
 */
export function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString()
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('base64')
  }
  if (Array.isArray(value)) {
    return value.map(jsonSafe)
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = jsonSafe(v)
    }
    return out
  }
  return value
}
