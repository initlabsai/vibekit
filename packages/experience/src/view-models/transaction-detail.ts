import { z } from 'zod'

import { uint64JsonSchema } from '../algo.js'
import { relatedEntityActionSchema, type RelatedEntityAction } from '../actions.js'
import { algorandAddressCandidateSchema, algorandTransactionIdSchema } from '../classifier.js'
import type { ViewSpec } from '../protocol.js'
import { resolveResultReference, type ResultResolutionError, type ResultStore } from '../results.js'
import { transactionDetailDataSchema } from '../transactions.js'

/** Renderer-ready semantic model for the trusted transaction detail view. */
export const transactionDetailViewModelSchema = z
  .object({
    view: z.literal('transaction.detail'),
    network: z.string().min(1),
    id: algorandTransactionIdSchema,
    type: z.string().min(1),
    status: z.enum(['confirmed', 'pending', 'failed']),
    sender: algorandAddressCandidateSchema,
    receiver: algorandAddressCandidateSchema.optional(),
    amountMicroAlgos: uint64JsonSchema.optional(),
    feeMicroAlgos: uint64JsonSchema,
    confirmedRound: z.number().int().nonnegative().optional(),
    roundTime: z.number().int().nonnegative().optional(),
    assetId: uint64JsonSchema.optional(),
    assetAmount: uint64JsonSchema.optional(),
    applicationId: uint64JsonSchema.optional(),
    relatedActions: z.array(relatedEntityActionSchema),
  })
  .strict()

/** Renderer-ready semantic model for the trusted transaction detail view. */
export type TransactionDetailViewModel = z.infer<typeof transactionDetailViewModelSchema>

/** Failure to derive a trusted view model from authoritative result data. */
export type ViewModelError = ResultResolutionError | { code: 'INVALID_VIEW_DATA'; message: string }

/** Result of deriving the renderer-ready transaction detail model. */
export type TransactionDetailViewModelResult =
  { ok: true; model: TransactionDetailViewModel } | { ok: false; error: ViewModelError }

function relatedActionsFor(
  view: ViewSpec,
  descriptors: z.infer<typeof transactionDetailDataSchema>['relatedEntities'],
): RelatedEntityAction[] {
  const basePath = view.source.path ?? []
  return descriptors.map((descriptor) => ({
    id: `related:${descriptor.relation}`,
    label: descriptor.label,
    action: 'open-related',
    entity: descriptor.entity,
    target: {
      source: view.source.source,
      id: view.source.id,
      path: [...basePath, ...descriptor.path],
    },
  }))
}

/** Derives transaction presentation and related actions from one trusted result reference. */
export function createTransactionDetailViewModel(
  store: ResultStore,
  view: ViewSpec,
): TransactionDetailViewModelResult {
  const resolution = resolveResultReference(store, view.source)
  if (!resolution.ok) return resolution

  const parsed = transactionDetailDataSchema.safeParse(resolution.value)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      error: {
        code: 'INVALID_VIEW_DATA',
        message: issue
          ? `Transaction result ${issue.path.join('.') || '(root)'}: ${issue.message}`
          : 'Transaction result did not match the trusted view schema',
      },
    }
  }

  const data = parsed.data
  const model = transactionDetailViewModelSchema.parse({
    view: 'transaction.detail',
    network: resolution.record.network,
    id: data.id,
    type: data.type,
    status: data.status,
    sender: data.sender,
    feeMicroAlgos: data.feeMicroAlgos,
    ...(data.receiver === undefined ? {} : { receiver: data.receiver }),
    ...(data.paymentAmountMicroAlgos === undefined
      ? {}
      : { amountMicroAlgos: data.paymentAmountMicroAlgos }),
    ...(data.confirmedRound === undefined ? {} : { confirmedRound: data.confirmedRound }),
    ...(data.roundTime === undefined ? {} : { roundTime: data.roundTime }),
    ...(data.assetId === undefined ? {} : { assetId: data.assetId }),
    ...(data.assetAmount === undefined ? {} : { assetAmount: data.assetAmount }),
    ...(data.applicationId === undefined ? {} : { applicationId: data.applicationId }),
    relatedActions: relatedActionsFor(view, data.relatedEntities),
  })
  return { ok: true, model }
}
