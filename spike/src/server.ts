/**
 * Spike version of @initlabs/mcp: one generic ToolDefinition → MCP adapter
 * over the official v2 SDK (2026-07-28 spec), per V2-DESIGN §5.
 */
import { McpServer } from '@modelcontextprotocol/server'
import algosdk from 'algosdk'
import { jsonSafe, ToolError, type NetworkId, type ToolContext, type ToolDefinition } from './contract'

const NETWORKS: Record<NetworkId, { algod: string; indexer: string }> = {
  mainnet: { algod: 'https://mainnet-api.algonode.cloud', indexer: 'https://mainnet-idx.algonode.cloud' },
  testnet: { algod: 'https://testnet-api.algonode.cloud', indexer: 'https://testnet-idx.algonode.cloud' },
  localnet: { algod: 'http://localhost:4001', indexer: 'http://localhost:8980' },
}

export interface SpikeMcpOptions {
  network: NetworkId
  tools: ToolDefinition[]
  mode: 'execute' | 'compose'
  resolveSigner?: ToolContext['resolveSigner']
}

/** Per-request clients would be pooled in the real thing; the spike builds them per factory call. */
export function buildContext(opts: SpikeMcpOptions): ToolContext {
  const endpoints = NETWORKS[opts.network]
  const localnetToken = 'a'.repeat(64)
  const token = opts.network === 'localnet' ? localnetToken : ''
  return {
    network: opts.network,
    algod: new algosdk.Algodv2(token, endpoints.algod),
    indexer: new algosdk.Indexer(token, endpoints.indexer),
    mode: opts.mode,
    resolveSigner: opts.resolveSigner,
    services: {},
  }
}

/** The factory: a fresh, stateless McpServer per connection/request. */
export function createSpikeMcp(opts: SpikeMcpOptions): McpServer {
  const server = new McpServer({ name: 'vibekit-spike', version: '0.0.0' })
  const ctx = buildContext(opts)

  for (const def of opts.tools) {
    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: def.parameters,
        annotations: { readOnlyHint: !def.requiresSigner },
        _meta: def.display ? { 'ai.vibekit/display': def.display } : undefined,
      },
      async (args: unknown) => {
        try {
          const result = jsonSafe(await def.handler(ctx, args as never))
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
        } catch (err) {
          const message =
            err instanceof ToolError
              ? `${err.code}: ${err.message}`
              : err instanceof Error
                ? err.message
                : String(err)
          return { content: [{ type: 'text' as const, text: message }], isError: true }
        }
      },
    )
  }

  return server
}
