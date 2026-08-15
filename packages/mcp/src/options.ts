import {
  createNetworkClients,
  resolveNetwork,
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
  /** Default network — used when a request doesn't specify one. */
  network: NetworkId | NetworkConfig
  /**
   * All networks this deployment serves (§10 state model). When more than one
   * (after including the default), the adapter injects a `network` parameter
   * into every tool: optional on reads, required on write tools. Omit for
   * single-network deployments — no parameter appears anywhere.
   */
  networks?: (NetworkId | NetworkConfig)[]
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
  /** Per-network contexts, pooled at startup. Keyed by network id. */
  contexts: Map<string, ToolContext>
  defaultNetwork: string
  /** Network ids served, default first. */
  networkIds: string[]
}

/**
 * Validate the tool registry and build pooled per-network contexts.
 * Throws at startup — never at request time — on duplicate tool/plugin names,
 * duplicate network ids, or execute mode without a signer.
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

  // Default network first, then the rest of `networks` (minus duplicates of the default).
  const defaultConfig = resolveNetwork(options.network)
  const extraConfigs = (options.networks ?? [])
    .map(resolveNetwork)
    .filter((config) => config.id !== defaultConfig.id)
  const configs = [defaultConfig, ...extraConfigs]

  const networkIds: string[] = []
  const contexts = new Map<string, ToolContext>()
  for (const config of configs) {
    if (contexts.has(config.id)) {
      throw new Error(`Duplicate network id: ${config.id}`)
    }
    networkIds.push(config.id)
    const clients = createNetworkClients(config)
    contexts.set(config.id, {
      network: config,
      servedNetworks: [], // filled below once all ids are known
      defaultNetwork: defaultConfig.id,
      algod: clients.algod,
      indexer: clients.indexer,
      mode: options.mode,
      resolveSigner: options.resolveSigner,
      services,
    })
  }
  for (const context of contexts.values()) {
    context.servedNetworks = networkIds
  }

  return {
    name: options.name ?? 'vibekit',
    version: options.version ?? '0.0.0',
    tools,
    contexts,
    defaultNetwork: defaultConfig.id,
    networkIds,
  }
}
