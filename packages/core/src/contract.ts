/**
 * The VibeKit tool contract (docs/DESIGN.md §4). One shape, no variants:
 * every tool in every package is a ToolDefinition; every host (MCP server,
 * query API, tests) adapts it with one generic adapter.
 */
import type algosdk from 'algosdk'
import type { z } from 'zod'
import type { NetworkConfig } from './network.js'

/** Presentation hint carried on the wire so every head renders from data. */
export type DisplayHint = 'table' | 'txn' | 'account' | 'asset' | 'markdown' | 'json'

export interface ToolContext {
  network: NetworkConfig
  /** Network ids this deployment serves (≥1, includes network.id). Hosts fill this; tools read it to orient. */
  servedNetworks: string[]
  /** Network id used when a request doesn't specify one. */
  defaultNetwork: string
  algod: algosdk.Algodv2
  indexer: algosdk.Indexer
  /** 'execute' = sign & send via resolveSigner; 'compose' = write tools return an UnsignedGroupResult. */
  mode: 'execute' | 'compose'
  /** Resolves a sender address to a signer. Absent in read-only and compose-only deployments. */
  resolveSigner?: (address: string) => Promise<algosdk.TransactionSigner>
  /** Plugin-provided clients, keyed by plugin name. Read via the plugin's typed accessor. */
  services: Record<string, unknown>
}

/** Write tools in compose mode return this instead of executing. */
export interface UnsignedGroupResult {
  /** base64-encoded unsigned transactions, in group order. */
  unsignedGroup: string[]
  /** Human-readable description of what signing this group does. */
  summary: string
}

export interface ToolDefinition<P extends z.ZodType = z.ZodType> {
  name: string
  description: string
  parameters: P
  /**
   * Result schema. Feeds MCP structured content and generated SDK result types
   * — input schemas alone can't (the gap v1's regex type-sync papered over).
   * Required for core tool packages; optional for plugins.
   */
  output?: z.ZodType
  /** Write tools set this; hosts gate on it and map it to MCP annotations. */
  requiresSigner?: boolean
  display?: DisplayHint
  handler: (ctx: ToolContext, args: z.infer<P>) => Promise<unknown>
}

/**
 * Identity helper so `parameters` inference flows into the handler's `args`
 * (annotating `const x: ToolDefinition` erases inference — spike finding).
 */
export function defineTool<P extends z.ZodType>(def: ToolDefinition<P>): ToolDefinition<P> {
  return def
}

/** Erased form for heterogeneous tool lists (registries, adapters). */
export type AnyTool = ToolDefinition<z.ZodType>

/**
 * A plugin is a package exporting a factory that returns this. The author's
 * factory captures config; the host injects `service` at `ctx.services[name]`.
 */
export interface ToolPlugin {
  /** Unique plugin name; becomes the services key. */
  name: string
  tools: AnyTool[]
  /** Pre-built client/service instance for this plugin's handlers. */
  service?: unknown
}
