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
  /**
   * Reads a local file, when the host grants it (the CLI, the TUI). Absent on
   * remote deployments, so a tool parameter naming a path cannot read the
   * server's filesystem.
   */
  readFile?: (path: string) => Promise<string>
}

/** What actions return in compose mode. */
export interface UnsignedGroupResult {
  /** base64-encoded unsigned transactions, in group order. */
  unsignedGroup: string[]
  summary: string
  /**
   * Per index: a base64 signed transaction some other party already signed
   * (a router's logicsig leg), or null where the user's wallet signs. Absent
   * means the wallet signs everything.
   */
  presigned?: (string | null)[]
  /** What the group does, for a host's approval screen: a swap, an order. */
  intent?: ActionIntent
}

/** The intents a host can summarize better than a transaction list. */
export type ActionIntent = OrderIntent | SwapIntent

export interface OrderIntent {
  kind: 'order'
  marketAppId: number
  title?: string
  side: 'yes' | 'no'
  action: 'buy' | 'sell'
  orderType: 'limit' | 'market'
  /** Dollars per share, 0..1 — the implied probability. */
  priceUsd: number
  /** Shares. */
  quantity: number
  /** price × quantity: what a buy locks up, what a sell returns at that price. */
  totalUsd: number
  slippagePercent?: number
}

export interface SwapIntent {
  kind: 'swap'
  fromAssetId: number
  toAssetId: number
  fromUnit: string
  toUnit: string
  fromDecimals: number
  toDecimals: number
  /** Base units of the input asset. */
  amountIn: string
  /** Base units of the output asset at the quoted price. */
  amountOut: string
  /** Base units the group refuses to settle below (after slippage). */
  minAmountOut: string
  slippagePercent: number
  priceImpactPercent?: number
  usdIn?: number
  usdOut?: number
  /** Venues by share of the input, e.g. Tinyman V2 60 / Pact 40. */
  route: Array<{ venue: string; percentage: number }>
}

export interface ToolDefinition<P extends z.ZodType = z.ZodType> {
  name: string
  description: string
  parameters: P
  /**
   * Checked by executeToolCall after jsonSafe, so describe the wire shape:
   * bigints arrive as number or string, bytes as base64. REST responses and
   * the generated reference are built from it.
   */
  output: z.ZodType
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
  // A method, not a function property: method parameters are checked
  // bivariantly, which is what lets a ToolDefinition<P> sit in an AnyTool[].
  handler(ctx: ToolContext, args: z.infer<P>): Promise<unknown>
}

/** Identity function; lets TypeScript infer the handler's args from `parameters`. */
export function defineTool<P extends z.ZodType>(def: ToolDefinition<P>): ToolDefinition<P> {
  return def
}

export type AnyTool = ToolDefinition<z.ZodType>

/**
 * A tool is a query or an action. Actions spend from or change state for a
 * user account (`requiresSigner` / `mutatesState`): hosts gate them behind
 * approval, and in compose mode they return a draft instead of sending.
 * Queries are free to run.
 */
export function isAction(tool: Pick<AnyTool, 'requiresSigner' | 'mutatesState'>): boolean {
  return Boolean(tool.requiresSigner || tool.mutatesState)
}

/** A read. Same as defineTool; the name documents intent. */
export function defineQuery<P extends z.ZodType>(
  def: Omit<ToolDefinition<P>, 'requiresSigner' | 'mutatesState'>,
): ToolDefinition<P> {
  return def
}

/** A tool that drafts a transaction group from a user account: signer-gated. */
export function defineAction<P extends z.ZodType>(
  def: Omit<ToolDefinition<P>, 'requiresSigner'>,
): ToolDefinition<P> {
  return { ...def, requiresSigner: true }
}

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
