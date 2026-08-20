/**
 * The tool contract. Every tool in every package is a ToolDefinition;
 * every host adapts this one shape.
 */
import type algosdk from 'algosdk'
import type { z } from 'zod'
import type { NetworkConfig } from './network.js'

export type DisplayHint = 'table' | 'txn' | 'account' | 'asset' | 'markdown' | 'json'

export interface ToolContext {
  network: NetworkConfig
  servedNetworks: string[]
  defaultNetwork: string
  algod: algosdk.Algodv2
  indexer: algosdk.Indexer
  /** 'execute' signs and sends; 'compose' returns unsigned transactions. */
  mode: 'execute' | 'compose'
  /** Missing in read-only and compose deployments. */
  resolveSigner?: (address: string) => Promise<algosdk.TransactionSigner>
  /** Plugin clients, keyed by plugin name. */
  services: Record<string, unknown>
}

/** What write tools return in compose mode. */
export interface UnsignedGroupResult {
  /** base64-encoded unsigned transactions, in group order. */
  unsignedGroup: string[]
  summary: string
}

export interface ToolDefinition<P extends z.ZodType = z.ZodType> {
  name: string
  description: string
  parameters: P
  /**
   * Checked by executeToolCall after jsonSafe, so describe the wire shape:
   * bigints arrive as number or string, bytes as base64.
   */
  output?: z.ZodType
  /** Spends from a user account. Hosts require approval and an explicit network. */
  requiresSigner?: boolean
  /** Changes state without spending user funds (key creation, faucet). Approval-gated. */
  mutatesState?: boolean
  /**
   * Coarse host hint (`table` / `txn` / `json` / …) for tools that have no
   * Explorer `view`. Do not set both: `view` is the card cue, and this is
   * only a fallback for MCP clients and plugins that have not declared one.
   */
  display?: DisplayHint
  /**
   * Semantic Explorer view id this tool's success payload binds to
   * (for example `transaction.detail`). Hosts that do not render views
   * ignore it. The experience registry decides which ids are trusted.
   */
  view?: string
  handler: (ctx: ToolContext, args: z.infer<P>) => Promise<unknown>
}

/** Identity function; lets TypeScript infer the handler's args from `parameters`. */
export function defineTool<P extends z.ZodType>(def: ToolDefinition<P>): ToolDefinition<P> {
  return def
}

export type AnyTool = ToolDefinition<z.ZodType>

/** Returned by a plugin factory. The host puts `service` at ctx.services[name]. */
export interface ToolPlugin {
  name: string
  tools: AnyTool[]
  service?: unknown
}
