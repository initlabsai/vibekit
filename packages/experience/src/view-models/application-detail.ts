import { z } from 'zod'

import { applicationDetailDataSchema } from '../applications.js'
import type { ViewSpec } from '../protocol.js'
import { resolveResultReference, type ResultStore } from '../results.js'
import type { ViewModelError } from './transaction-detail.js'

/** Renderer-ready semantic model for the trusted application detail view. */
export const applicationDetailViewModelSchema = z
  .object({
    view: z.literal('application.detail'),
    network: z.string().min(1),
    applicationId: applicationDetailDataSchema.shape.applicationId,
    creator: z.string().optional(),
    account: z.string().optional(),
    globalStateCount: z.number().int().nonnegative(),
    localStateSchema: applicationDetailDataSchema.shape.localStateSchema,
    globalStateSchema: applicationDetailDataSchema.shape.globalStateSchema,
  })
  .strict()

/** Renderer-ready semantic model for the trusted application detail view. */
export type ApplicationDetailViewModel = z.infer<typeof applicationDetailViewModelSchema>

/** Result of deriving the renderer-ready application detail model. */
export type ApplicationDetailViewModelResult =
  { ok: true; model: ApplicationDetailViewModel } | { ok: false; error: ViewModelError }

/** Derives application presentation from one trusted result reference. */
export function createApplicationDetailViewModel(
  store: ResultStore,
  view: ViewSpec,
): ApplicationDetailViewModelResult {
  const resolution = resolveResultReference(store, view.source)
  if (!resolution.ok) return resolution

  const parsed = applicationDetailDataSchema.safeParse(resolution.value)
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_VIEW_DATA',
        message: 'Application result did not match the trusted application schema',
      },
    }
  }
  return {
    ok: true,
    model: applicationDetailViewModelSchema.parse({
      view: 'application.detail',
      network: resolution.record.network,
      ...parsed.data,
    }),
  }
}
