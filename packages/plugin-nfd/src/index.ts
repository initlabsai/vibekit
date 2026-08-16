/**
 * NFD plugin: name resolution tools over @txnlab/nfd-sdk.
 * A ToolPlugin proving the plugin contract — tools get their client via the
 * services bag, keyed by plugin name, through the typed accessor below.
 */
import { defineTool, ToolError, type AnyTool, type ToolContext, type ToolPlugin } from '@initlabs/vibekit-core'
import { NfdApiClient } from '@txnlab/nfd-sdk'
import { z } from 'zod'

export const PLUGIN_NAME = 'nfd'

/** NFD serves mainnet and testnet; clients are cached per network id. */
export interface NfdService {
  clientFor(networkId: string): NfdApiClient
}

function createNfdService(): NfdService {
  const clients = new Map<string, NfdApiClient>()
  return {
    clientFor(networkId) {
      const cached = clients.get(networkId)
      if (cached) return cached
      if (networkId !== 'mainnet' && networkId !== 'testnet') {
        throw new ToolError('UNSUPPORTED_NETWORK', `NFD is not available on ${networkId} (mainnet/testnet only)`)
      }
      const client = networkId === 'testnet' ? NfdApiClient.testNet() : NfdApiClient.mainNet()
      clients.set(networkId, client)
      return client
    },
  }
}

/** Typed accessor — the plugin-side pattern for reading ctx.services. */
export function getNfdClient(ctx: ToolContext): NfdApiClient {
  const service = ctx.services[PLUGIN_NAME] as NfdService | undefined
  if (!service) {
    throw new ToolError('PLUGIN_NOT_CONFIGURED', 'The nfd plugin is not registered in this deployment')
  }
  return service.clientFor(ctx.network.id)
}

/** ipfs:// → HTTPS gateway URL; non-IPFS input passes through. */
function ipfsToHttps(url: string): string | undefined {
  if (url.startsWith('ipfs://')) return url.replace('ipfs://', 'https://images.nf.domains/ipfs/')
  // User-controlled field: only https survives (review finding - javascript:/data:
  // schemes previously passed through verbatim).
  return url.startsWith('https://') ? url : undefined
}

/** Pick well-known social/profile fields from NFD properties. */
function extractProperties(properties?: {
  internal?: Record<string, string>
  userDefined?: Record<string, string>
  verified?: Record<string, string>
}) {
  if (!properties) return undefined
  const v = properties.verified ?? {}
  const u = properties.userDefined ?? {}
  const picked: Record<string, string> = {}

  const avatar = (v.avatar && ipfsToHttps(v.avatar)) || (u.avatar && ipfsToHttps(u.avatar))
  if (avatar) picked.avatar = avatar
  else if (v.avatarasaid) picked.avatar = `assetid:${v.avatarasaid}`

  for (const key of ['twitter', 'discord', 'telegram', 'github', 'email', 'domain', 'blueskydid', 'nostrpubkey'] as const) {
    if (v[key]) picked[key] = v[key]
  }
  for (const key of ['bio', 'website', 'name'] as const) {
    if (u[key] && !picked[key]) picked[key] = u[key]!
  }
  return Object.keys(picked).length > 0 ? picked : undefined
}

const propertiesSchema = z.record(z.string(), z.string()).optional()

export const nfdTools: AnyTool[] = [
  defineTool({
    name: 'resolve_nfd',
    description:
      'Resolve an NFD name (e.g. "vibekit.algo") to its Algorand deposit address. Use when a user refers to an account by name instead of address.',
    parameters: z.object({
      name: z.string().describe('The NFD name to resolve (e.g. "vibekit.algo")'),
    }),
    output: z.object({
      name: z.string(),
      address: z.string().optional(),
      owner: z.string().optional(),
      appId: z.number().optional(),
      state: z.string().optional(),
      properties: propertiesSchema,
    }),
    display: 'account',
    handler: async (ctx, args) => {
      const nfd = await getNfdClient(ctx).resolve(args.name.toLowerCase(), { view: 'full' })
      return {
        name: nfd.name,
        address: nfd.depositAccount ?? nfd.owner,
        owner: nfd.owner,
        appId: nfd.appID,
        state: nfd.state,
        properties: extractProperties(nfd.properties),
      }
    },
  }),
  defineTool({
    name: 'reverse_resolve_nfd',
    description:
      'Look up the NFD name associated with an Algorand address, to display a human-readable name.',
    parameters: z.object({
      address: z.string().describe('The Algorand address to look up'),
    }),
    output: z.object({
      address: z.string(),
      name: z.string().nullable(),
      appId: z.number().optional(),
      properties: propertiesSchema,
    }),
    display: 'account',
    handler: async (ctx, args) => {
      const result = await getNfdClient(ctx).reverseLookup([args.address], { view: 'full' })
      const nfd = result[args.address]
      if (!nfd) return { address: args.address, name: null }
      return {
        address: args.address,
        name: nfd.name,
        appId: nfd.appID,
        properties: extractProperties(nfd.properties),
      }
    },
  }),
  defineTool({
    name: 'batch_reverse_resolve_nfd',
    description:
      'Look up NFD names for multiple addresses at once. Prefer over repeated reverse_resolve_nfd for 2+ addresses.',
    parameters: z.object({
      addresses: z.array(z.string()).describe('The Algorand addresses to look up'),
    }),
    output: z.object({
      results: z.array(
        z.object({
          address: z.string(),
          name: z.string().nullable(),
          avatar: z.string().optional(),
        }),
      ),
    }),
    display: 'table',
    handler: async (ctx, args) => {
      const result = await getNfdClient(ctx).reverseLookup(args.addresses, { view: 'thumbnail' })
      return {
        results: args.addresses.map((address) => {
          const nfd = result[address]
          if (!nfd) return { address, name: null }
          const v = nfd.properties?.verified ?? {}
          const u = nfd.properties?.userDefined ?? {}
          let avatar: string | undefined
          if (v.avatar) avatar = ipfsToHttps(v.avatar)
          else if (v.avatarasaid) avatar = `assetid:${v.avatarasaid}`
          else if (u.avatar) avatar = ipfsToHttps(u.avatar)
          return { address, name: nfd.name, avatar }
        }),
      }
    },
  }),
] as AnyTool[]

/** The plugin factory — `plugins: [nfdPlugin()]` in createVibekitMcp options. */
export function nfdPlugin(): ToolPlugin {
  return {
    name: PLUGIN_NAME,
    tools: nfdTools,
    service: createNfdService(),
  }
}
