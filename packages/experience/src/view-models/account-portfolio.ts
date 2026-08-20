import { z } from 'zod'

import { accountAssetHoldingSchema, accountPortfolioDataSchema } from '../accounts.js'
import { uint64JsonSchema } from '../algo.js'
import { algorandAddressCandidateSchema } from '../classifier.js'
import type { ViewSpec } from '../protocol.js'
import { resolveResultReference, type ResultStore } from '../results.js'
import type { ViewModelError } from './transaction-detail.js'

/** Renderer-ready semantic model for the trusted account portfolio view. */
export const accountPortfolioViewModelSchema = z
  .object({
    view: z.literal('account.portfolio'),
    network: z.string().min(1),
    address: algorandAddressCandidateSchema,
    balanceMicroAlgos: uint64JsonSchema,
    totalAssets: z.number().int().nonnegative(),
    assets: z.array(accountAssetHoldingSchema),
  })
  .strict()

/** Renderer-ready semantic model for the trusted account portfolio view. */
export type AccountPortfolioViewModel = z.infer<typeof accountPortfolioViewModelSchema>

/** Result of deriving the renderer-ready account portfolio model. */
export type AccountPortfolioViewModelResult =
  { ok: true; model: AccountPortfolioViewModel } | { ok: false; error: ViewModelError }

/** Derives account presentation from one trusted result reference. */
export function createAccountPortfolioViewModel(
  store: ResultStore,
  view: ViewSpec,
): AccountPortfolioViewModelResult {
  const resolution = resolveResultReference(store, view.source)
  if (!resolution.ok) return resolution

  const parsed = accountPortfolioDataSchema.safeParse(resolution.value)
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_VIEW_DATA',
        message: 'Account result did not match the trusted portfolio schema',
      },
    }
  }
  return {
    ok: true,
    model: accountPortfolioViewModelSchema.parse({
      view: 'account.portfolio',
      network: resolution.record.network,
      ...parsed.data,
    }),
  }
}
