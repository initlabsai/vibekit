/**
 * The tool contract. Every tool in every package is a ToolDefinition;
 * every host adapts this one shape.
 */
import type algosdk from 'algosdk'
import type { z } from 'zod'
import type { NetworkConfig } from './network.js'

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
  /** Read whose result is large (a whole program). Hosts may ask before running it. */
  expensive?: boolean
  /**
   * The tool's view. Either a semantic Explorer view id the success
   * payload binds to (dotted, for example `transaction.detail` — the
   * explorer registry decides which ids are trusted) or a coarse rendering
   * hint for everything else (`table`, `txn`, `json`, `markdown`, `account`).
   * Hosts that do not render views ignore it.
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
  /** One line for settings screens: what the plugin adds and where it reaches. */
  description?: string
  tools: AnyTool[]
  service?: unknown
  /**
   * Trusted views this plugin's tools declare, keyed by plugin-namespaced
   * dotted id (`nfd.profile`) — the same `view` the tool carries — each
   * mapped to the zod schema of its success wire (post-jsonSafe). Rendering
   * hosts parse the wire with this schema before showing a card; headless
   * hosts ignore it. Unregistered ids fall back to a raw record.
   */
  views?: Record<string, z.ZodType>
}
