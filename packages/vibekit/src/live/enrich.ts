/**
 * The enrichment host: a signerless deployment of the read plugins beside
 * the live host — names, verification tiers, logos, prices, markets — so a
 * card can ask for them and page them. Every call still runs through
 * executeToolCall; the tool list is the plugins' and nothing else.
 */
import { executeToolCall, resolveDeployment, type NetworkConfig } from '../core/index.js'
import { alphaArcadePlugin } from '../plugins/alpha-arcade/index.js'
import { nfdPlugin } from '../plugins/nfd/index.js'
import { peraPlugin } from '../plugins/pera/index.js'
import { vestigePlugin } from '../plugins/vestige/index.js'

import type { LiveNetworkId } from '../views/host.js'
import { alphaOptions } from './plugin-options.js'

export interface EnrichmentHost {
  network: string
  /** The plugin tools by name. */
  toolNames: readonly string[]
  /** Runs one plugin tool and returns its wire output. Unknown names throw. */
  callTool(toolName: string, args: Record<string, unknown>): Promise<unknown>
  /** The view id a plugin tool declares, so a host can wrap its wire as a record. */
  viewOf(toolName: string): string | undefined
}

export function createEnrichmentHost(config: LiveNetworkId | NetworkConfig): EnrichmentHost {
  const deployment = resolveDeployment({
    network: config,
    mode: 'compose',
    plugins: [nfdPlugin(), peraPlugin(), vestigePlugin(), alphaArcadePlugin(alphaOptions())],
  })
  return {
    network: typeof config === 'string' ? config : config.id,
    toolNames: deployment.tools.map((tool) => tool.name),
    async callTool(toolName, args) {
      const tool = deployment.tools.find((candidate) => candidate.name === toolName)
      if (!tool) throw new Error(`This host has no tool named ${toolName}`)
      return executeToolCall(deployment, tool, args)
    },
    viewOf: (toolName) => deployment.tools.find((tool) => tool.name === toolName)?.view,
  }
}
