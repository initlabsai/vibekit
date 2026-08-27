/**
 * Turns a config into a running deployment and runs every tool call through
 * one choke point. Shared by all hosts.
 */

import { z } from 'zod'

import { jsonSafe } from './codec.js'
import { ToolError } from './errors.js'
import type { AnyTool, ToolContext, ToolPlugin } from './contract.js'
import {
  createNetworkClients,
  resolveNetwork,
  type NetworkConfig,
  type NetworkId,
} from './network.js'

export interface DeploymentOptions {
  /** Default when a request doesn't specify one. */
  network: NetworkId | NetworkConfig
  /**
   * Serving more than one network injects a `network` param into every tool:
   * optional on reads, required on writes. Omit for single-network.
   */
  networks?: (NetworkId | NetworkConfig)[]
  mode: 'execute' | 'compose'
  tools?: AnyTool[]
  plugins?: ToolPlugin[]
  resolveSigner?: ToolContext['resolveSigner']
  /** Grants tools local file reads (appSpecPath); leave unset on remote hosts. */
  readFile?: ToolContext['readFile']
}

export interface ResolvedDeployment {
  tools: AnyTool[]
  /** Built once at startup, keyed by network id. */
  contexts: Map<string, ToolContext>
  defaultNetwork: string
  /** Default first. */
  networkIds: string[]
}

/**
 * Validates the registry and builds per-network contexts. Config errors
 * (duplicate names, execute mode without a signer) throw here, at startup.
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
    throw new Error(
      "mode 'execute' requires resolveSigner; use mode 'compose' for signer-less deployments",
    )
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
      readFile: options.readFile,
      services,
    })
  }
  for (const context of contexts.values()) {
    context.servedNetworks = networkIds
    // Frozen so a handler or plugin cannot swap resolveSigner.
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
 * The tool's wire-facing parameter schema. Multi-network deployments get a
 * `network` enum: optional on reads, required on writes.
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

function issuesOf(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ')
}

/**
 * Runs one tool call. Throws ToolError; each host maps errors to its own
 * wire shape.
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
      // Also enforced here for hosts that skip schema parsing.
      throw new ToolError(
        'NETWORK_REQUIRED',
        `Tool ${tool.name} writes to the chain — pass an explicit 'network'`,
      )
    }
    handlerArgs = rest
  }
  const context = deployment.contexts.get(networkId)
  if (!context) {
    throw new ToolError('UNKNOWN_NETWORK', `Network not served: ${networkId}`)
  }
  // Every host validates here, whatever it parsed before: the handler sees
  // exactly what its schema declares (defaults applied, extras dropped).
  const args = tool.parameters.safeParse(handlerArgs)
  if (!args.success) {
    throw new ToolError('INVALID_ARGS', `Tool ${tool.name}: ${issuesOf(args.error)}`)
  }
  const result = jsonSafe(await tool.handler(context, args.data as never))
  if (tool.output) {
    // Validation only: the original result is returned, never a stripped parse.
    const parsed = tool.output.safeParse(result)
    if (!parsed.success) {
      throw new ToolError(
        'OUTPUT_MISMATCH',
        `Tool ${tool.name} returned a result that violates its output schema — ${issuesOf(parsed.error)}`,
      )
    }
  }
  return result
}
