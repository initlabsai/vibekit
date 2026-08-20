import { z } from 'zod'

import { assetDetailDataSchema } from '../assets.js'
import type { ViewSpec } from '../protocol.js'
import { resolveResultReference, type ResultStore } from '../results.js'
import type { ViewModelError } from './transaction-detail.js'

/** Renderer-ready semantic model for the trusted asset detail view. */
export const assetDetailViewModelSchema = z
  .object({
    view: z.literal('asset.detail'),
    network: z.string().min(1),
    assetId: assetDetailDataSchema.shape.assetId,
    name: z.string().min(1).optional(),
    unitName: z.string().min(1).optional(),
    totalSupply: z.string().regex(/^\d+$/),
    decimals: z.number().int().nonnegative(),
    creator: z.string().optional(),
    manager: z.string().optional(),
    reserve: z.string().optional(),
    freeze: z.string().optional(),
    clawback: z.string().optional(),
    defaultFrozen: z.boolean().optional(),
    url: z.string().optional(),
  })
  .strict()

/** Renderer-ready semantic model for the trusted asset detail view. */
export type AssetDetailViewModel = z.infer<typeof assetDetailViewModelSchema>

/** Result of deriving the renderer-ready asset detail model. */
export type AssetDetailViewModelResult =
  { ok: true; model: AssetDetailViewModel } | { ok: false; error: ViewModelError }

/** Derives asset presentation from one trusted result reference. */
export function createAssetDetailViewModel(
  store: ResultStore,
  view: ViewSpec,
): AssetDetailViewModelResult {
  const resolution = resolveResultReference(store, view.source)
  if (!resolution.ok) return resolution

  const parsed = assetDetailDataSchema.safeParse(resolution.value)
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_VIEW_DATA',
        message: 'Asset result did not match the trusted asset schema',
      },
    }
  }
  return {
    ok: true,
    model: assetDetailViewModelSchema.parse({
      view: 'asset.detail',
      network: resolution.record.network,
      ...parsed.data,
    }),
  }
}
