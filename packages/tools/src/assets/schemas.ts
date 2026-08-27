import { z } from 'zod'

/**
 * Wire shape of the 'asset.detail' view — one shape for both sources:
 * lookup_asset (indexer summary) and get_asset_info (algod params).
 * Fields a source lacks are simply absent.
 */
export const assetDetailSchema = z.object({
  assetId: z.number(),
  name: z.string().optional(),
  unitName: z.string().optional(),
  totalSupply: z.string().regex(/^\d+$/).describe('Raw base units'),
  totalSupplyScaled: z.string().describe('Supply in whole tokens, comma-grouped; quote this one'),
  totalSupplyApprox: z.string().optional().describe("Magnitude in words, e.g. '≈1 trillion'; lead with this"),
  decimals: z.number(),
  creator: z.string().optional(),
  manager: z.string().optional(),
  reserve: z.string().optional(),
  freeze: z.string().optional(),
  clawback: z.string().optional(),
  defaultFrozen: z.boolean().optional(),
  url: z.string().optional(),
})

/** Wire shape of search_asset_balances ('asset.holders' view). */
export const assetHoldersSchema = z.object({
  balances: z.array(
    z.object({
      address: z.string(),
      amount: z.string().describe('Raw base units as a decimal string; scale by decimals for display'),
      isFrozen: z.boolean(),
    }),
  ),
  decimals: z.number().optional().describe('Asset decimals; absent when metadata lookup failed'),
  nextToken: z.string().optional(),
})

/** Wire shape of search_assets ('asset.list' view). */
export const assetListSchema = z.object({
  assets: z.array(assetDetailSchema),
  nextToken: z.string().optional(),
})
