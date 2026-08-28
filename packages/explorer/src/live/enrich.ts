/**
 * The enrichment host: a signerless deployment of the nfd, pera, and
 * vestige plugin tools beside the live host, so a card can ask for names,
 * verification tiers, logos, and prices. Every call still runs through
 * executeToolCall; the tool list is the three plugins' and nothing else.
 */
import { executeToolCall, resolveDeployment, type NetworkConfig } from '@initlabs/vibekit'
import { nfdPlugin } from '@initlabs/vibekit/plugins/nfd'
import { peraPlugin } from '@initlabs/vibekit/plugins/pera'
import { vestigePlugin } from '@initlabs/vibekit/plugins/vestige'

import type { LiveNetworkId } from '../host.js'

export interface EnrichmentHost {
  network: string
  /** The plugin tools by name. */
  toolNames: readonly string[]
  /** Runs one plugin tool and returns its wire output. Unknown names throw. */
  callTool(toolName: string, args: Record<string, unknown>): Promise<unknown>
}

export function createEnrichmentHost(config: LiveNetworkId | NetworkConfig): EnrichmentHost {
  const deployment = resolveDeployment({
    network: config,
    mode: 'compose',
    plugins: [nfdPlugin(), peraPlugin(), vestigePlugin()],
  })
  return {
    network: typeof config === 'string' ? config : config.id,
    toolNames: deployment.tools.map((tool) => tool.name),
    async callTool(toolName, args) {
      const tool = deployment.tools.find((candidate) => candidate.name === toolName)
      if (!tool) throw new Error(`This host has no tool named ${toolName}`)
      return executeToolCall(deployment, tool, args)
    },
  }
}
