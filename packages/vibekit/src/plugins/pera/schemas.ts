import { z } from 'zod'

/** get_asset_profile's wire shape (the `pera.asset` view). */
export const assetProfileSchema = z.object({
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
})
export type AssetProfile = z.infer<typeof assetProfileSchema>
