import {
  createNetworkClients,
  type AnyTool,
  type NetworkConfig,
  type NetworkId,
  type ToolContext,
  type ToolPlugin,
} from '@initlabs/core'

export interface VibekitMcpOptions {
  /** Server identity advertised to clients. */
  name?: string
  version?: string
  network: NetworkId | NetworkConfig
  /** 'execute' requires resolveSigner; 'compose' returns unsigned groups (the HTTP default posture). */
  mode: 'execute' | 'compose'
  tools?: AnyTool[]
  plugins?: ToolPlugin[]
  resolveSigner?: ToolContext['resolveSigner']
}

export interface ResolvedDeployment {
  name: string
  version: string
  /** All tools, registry-validated (unique names). */
  tools: AnyTool[]
  /** Shared per-deployment context; safe because tools hold no state. */
  context: ToolContext
}

/**
 * Validate the tool registry and build the shared deployment context.
 * Throws at startup — never at request time — on duplicate tool or plugin names.
 */
export function resolveDeployment(options: VibekitMcpOptions): ResolvedDeployment {
  const plugins = options.plugins ?? []

  const pluginNames = new Set<string>()
  for (const plugin of plugins) {
    if (pluginNames.has(plugin.name)) {
      throw new Error(`Duplicate plugin name: ${plugin.name}`)
    }
    pluginNames.add(plugin.name)
  }

  const tools = [...(options.tools ?? []), ...plugins.flatMap((p) => p.tools)]
  const toolNames = new Set<string>()
  for (const tool of tools) {
    if (toolNames.has(tool.name)) {
      throw new Error(`Duplicate tool name: ${tool.name}`)
    }
    toolNames.add(tool.name)
  }

  if (options.mode === 'execute' && !options.resolveSigner) {
    throw new Error("mode 'execute' requires resolveSigner; use mode 'compose' for signer-less deployments")
  }

  const services: Record<string, unknown> = {}
  for (const plugin of plugins) {
    if (plugin.service !== undefined) services[plugin.name] = plugin.service
  }

  const clients = createNetworkClients(options.network)
  return {
    name: options.name ?? 'vibekit',
    version: options.version ?? '0.0.0',
    tools,
    context: {
      network: clients.network,
      algod: clients.algod,
      indexer: clients.indexer,
      mode: options.mode,
      resolveSigner: options.resolveSigner,
      services,
    },
  }
}
