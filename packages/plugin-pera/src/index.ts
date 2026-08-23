/**
 * Pera plugin: the curated asset registry behind Pera Wallet — verification
 * tier (scam guard), project identity, and USD price for one asset. Free
 * public API, mainnet and testnet.
 */
import { defineTool, ToolError, type AnyTool, type ToolContext, type ToolPlugin } from '@initlabs/vibekit-core'
import { z } from 'zod'

export const PLUGIN_NAME = 'pera'

export interface PeraService {
  get(networkId: string, path: string): Promise<unknown>
}

function createPeraService(): PeraService {
  return {
    async get(networkId, path) {
      const response = await fetch(`https://${networkId}.api.perawallet.app/v1${path}`)
      if (response.status === 404) {
        throw new ToolError('NOT_FOUND', `Pera has no record of this asset on ${networkId}`)
      }
      if (!response.ok) {
        throw new ToolError('PERA_ERROR', `Pera API ${response.status} for ${path}`)
      }
      return response.json()
    },
  }
}

/** Typed accessor — the plugin-side pattern for reading ctx.services. */
export function getPera(ctx: ToolContext): { get(path: string): Promise<unknown> } {
  const service = ctx.services[PLUGIN_NAME] as PeraService | undefined
  if (!service) {
    throw new ToolError('PLUGIN_NOT_CONFIGURED', 'The pera plugin is not registered in this deployment')
  }
  const networkId = ctx.network.id
  if (networkId !== 'mainnet' && networkId !== 'testnet') {
    throw new ToolError('UNSUPPORTED_NETWORK', `Pera serves mainnet and testnet only, not ${networkId}`)
  }
  return { get: (path) => service.get(networkId, path) }
}

interface WireAssetDetail {
  asset_id: number
  name: string | null
  unit_name: string | null
  url: string | null
  logo: string | null
  verification_tier: string
  usd_value: string | null
  usd_value_24_hour_ago: string | null
  is_collectible: boolean
  description: string | null
  verification_details: {
    project_name?: string | null
    project_url?: string | null
    project_description?: string | null
    discord_url?: string | null
    telegram_url?: string | null
    twitter_username?: string | null
  } | null
}

const nonEmpty = (value: string | null | undefined): string | undefined => (value ? value : undefined)

export const peraTools: AnyTool[] = [
  defineTool({
    name: 'get_asset_profile',
    description:
      "Pera Wallet's curated profile of an asset: verification tier (trusted/verified/unverified/suspicious), project identity (website, socials, description), logo, and USD price. Check it before presenting an unfamiliar asset; tell the user plainly when the tier is suspicious or unverified.",
    parameters: z.object({
      assetId: z.number().describe('The asset ID'),
    }),
    output: z.object({
      assetId: z.number(),
      verificationTier: z.string().describe('trusted | verified | unverified | suspicious'),
      name: z.string().optional(),
      unitName: z.string().optional(),
      url: z.string().optional(),
      logoUrl: z.string().optional(),
      priceUsd: z.string().optional().describe('USD price as a plain decimal string'),
      priceUsd24hAgo: z.string().optional(),
      isCollectible: z.boolean(),
      description: z.string().optional(),
      project: z
        .object({
          name: z.string().optional(),
          url: z.string().optional(),
          description: z.string().optional(),
          twitter: z.string().optional(),
          discord: z.string().optional(),
          telegram: z.string().optional(),
        })
        .optional(),
    }),
    view: 'json',
    handler: async (ctx: ToolContext, args: { assetId: number }) => {
      const wire = (await getPera(ctx).get(`/public/assets/${args.assetId}/`)) as WireAssetDetail
      const details = wire.verification_details
      const project = details
        ? {
            name: nonEmpty(details.project_name),
            url: nonEmpty(details.project_url),
            description: nonEmpty(details.project_description),
            twitter: nonEmpty(details.twitter_username),
            discord: nonEmpty(details.discord_url),
            telegram: nonEmpty(details.telegram_url),
          }
        : undefined
      return {
        assetId: wire.asset_id,
        verificationTier: wire.verification_tier,
        name: nonEmpty(wire.name),
        unitName: nonEmpty(wire.unit_name),
        url: nonEmpty(wire.url),
        logoUrl: nonEmpty(wire.logo),
        priceUsd: nonEmpty(wire.usd_value),
        priceUsd24hAgo: nonEmpty(wire.usd_value_24_hour_ago),
        isCollectible: wire.is_collectible,
        description: nonEmpty(wire.description),
        project: project && Object.values(project).some(Boolean) ? project : undefined,
      }
    },
  }),
]

/** The plugin factory — `plugins: [peraPlugin()]` in deployment options. */
export function peraPlugin(): ToolPlugin {
  return { name: PLUGIN_NAME, tools: peraTools, service: createPeraService() }
}
