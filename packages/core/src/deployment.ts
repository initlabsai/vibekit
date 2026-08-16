/**
 * Deployment resolution — shared by every host that embeds the tools
 * (MCP server, agent orchestrator). Validates the tool registry and builds
 * pooled per-network ToolContexts at startup, and implements the §10
 * multi-network semantics: a `network` parameter injected into tool schemas
 * (optional on reads, required on writes) only when >1 network is served.
 */

import { z } from 'zod'

import { jsonSafe } from './codec.js'
import { ToolError } from './errors.js'
import type { AnyTool, ToolContext, ToolPlugin } from './contract.js'
import { createNetworkClients, resolveNetwork, type NetworkConfig, type NetworkId } from './network.js'

export interface DeploymentOptions {
  /** Default network — used when a request doesn't specify one. */
  network: NetworkId | NetworkConfig
  /**
   * All networks this deployment serves (§10 state model). When more than one
   * (after including the default), hosts inject a `network` parameter into
   * every tool: optional on reads, required on write tools. Omit for
   * single-network deployments — no parameter appears anywhere.
   */
  networks?: (NetworkId | NetworkConfig)[]
  /** 'execute' requires resolveSigner; 'compose' returns unsigned groups. */
  mode: 'execute' | 'compose'
  tools?: AnyTool[]
  plugins?: ToolPlugin[]
  resolveSigner?: ToolContext['resolveSigner']
}

export interface ResolvedDeployment {
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
export function resolveDeployment(options: DeploymentOptions): ResolvedDeployment {
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
    // The constitution lists ToolContext immutability as an edge — make it true by
    // construction, not convention: a handler (or stranger plugin) that tries
    // to mutate ctx or replace resolveSigner throws instead of succeeding.
    Object.freeze(context.services)
    Object.freeze(context)
  }

  return {
    tools,
    contexts,
    defaultNetwork: defaultConfig.id,
    networkIds,
  }
}

/** Reserved parameter name injected by multi-network deployments. */
export const NETWORK_PARAM = 'network'

/**
 * The tool's wire-facing parameter schema: on multi-network deployments a
 * `network` enum of exactly the served ids is injected — optional (falls back
 * to the default) on read tools, required on `requiresSigner` tools so nothing
 * ever spends on a silently-defaulted chain.
 */
export function injectNetworkParam(tool: AnyTool, deployment: ResolvedDeployment): z.ZodType {
  if (deployment.networkIds.length < 2) return tool.parameters

  if (!(tool.parameters instanceof z.ZodObject)) {
    throw new Error(
      `Tool ${tool.name}: multi-network deployments require z.object() parameters so the network param can be injected`,
    )
  }
  if (NETWORK_PARAM in tool.parameters.shape) {
    throw new Error(`Tool ${tool.name}: '${NETWORK_PARAM}' is a reserved parameter name`)
  }

  const ids = deployment.networkIds as [string, ...string[]]
  const base = z.enum(ids)
  const networkSchema = tool.requiresSigner
    ? base.describe('Network to execute on. Required: never write to a defaulted chain.')
    : base.optional().describe(`Network to query (default: ${deployment.defaultNetwork})`)
  return tool.parameters.extend({ [NETWORK_PARAM]: networkSchema })
}

/**
 * Run one tool call: extract the injected network param (multi-network only),
 * pick the pooled context, invoke the handler, and make the result JSON-safe.
 * Throws ToolError — each host maps errors to its own wire shape exactly once.
 */
export async function executeToolCall(
  deployment: ResolvedDeployment,
  tool: AnyTool,
  rawArgs: unknown,
): Promise<unknown> {
  let handlerArgs = rawArgs as Record<string, unknown>
  let networkId = deployment.defaultNetwork
  if (deployment.networkIds.length > 1 && handlerArgs && typeof handlerArgs === 'object') {
    const { [NETWORK_PARAM]: requested, ...rest } = handlerArgs
    if (typeof requested === 'string') networkId = requested
    else if (tool.requiresSigner) {
      // The schema requires this, but executeToolCall is the enforcement
      // point for hosts that skip schema parsing (§10: never write to a
      // silently-defaulted chain).
      throw new ToolError('NETWORK_REQUIRED', `Tool ${tool.name} writes to the chain — pass an explicit 'network'`)
    }
    handlerArgs = rest
  }
  const context = deployment.contexts.get(networkId)
  if (!context) {
    throw new ToolError('UNKNOWN_NETWORK', `Network not served: ${networkId}`)
  }
  const result = jsonSafe(await tool.handler(context, handlerArgs as never))
  if (tool.output) {
    // Validate the declared result contract (post-jsonSafe, the shape hosts
    // actually emit). Validation only — the original result is returned, so a
    // schema that under-declares fields fails loudly here instead of silently
    // stripping data.
    const parsed = tool.output.safeParse(result)
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ')
      throw new ToolError('OUTPUT_MISMATCH', `Tool ${tool.name} returned a result that violates its output schema — ${issues}`)
    }
  }
  return result
}
