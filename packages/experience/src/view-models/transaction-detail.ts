import { z } from 'zod'

import { uint64JsonSchema } from '../algo.js'
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
    assetName: z.string().min(1).optional(),
    assetUnitName: z.string().min(1).optional(),
    assetDecimals: z.number().int().nonnegative().optional(),
    applicationId: uint64JsonSchema.optional(),
    onCompletion: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
    group: z.string().min(1).optional(),
    innerCount: z.number().int().nonnegative().optional(),
    rekeyTo: algorandAddressCandidateSchema.optional(),
    closeTo: algorandAddressCandidateSchema.optional(),
    closeAmountMicroAlgos: uint64JsonSchema.optional(),
    closeAssetAmount: uint64JsonSchema.optional(),
    clawbackFrom: algorandAddressCandidateSchema.optional(),
  })
  .strict()

/** Renderer-ready semantic model for the trusted transaction detail view. */
export type TransactionDetailViewModel = z.infer<typeof transactionDetailViewModelSchema>

/** Failure to derive a trusted view model from authoritative result data. */
export type ViewModelError = ResultResolutionError | { code: 'INVALID_VIEW_DATA'; message: string }

/** Result of deriving the renderer-ready transaction detail model. */
export type TransactionDetailViewModelResult =
  { ok: true; model: TransactionDetailViewModel } | { ok: false; error: ViewModelError }

/** Derives transaction presentation from one trusted result reference. */
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
    ...(data.assetName === undefined ? {} : { assetName: data.assetName }),
    ...(data.assetUnitName === undefined ? {} : { assetUnitName: data.assetUnitName }),
    ...(data.assetDecimals === undefined ? {} : { assetDecimals: data.assetDecimals }),
    ...(data.applicationId === undefined ? {} : { applicationId: data.applicationId }),
    ...(data.onCompletion === undefined ? {} : { onCompletion: data.onCompletion }),
    ...(data.note === undefined ? {} : { note: data.note }),
    ...(data.group === undefined ? {} : { group: data.group }),
    ...(data.innerCount === undefined ? {} : { innerCount: data.innerCount }),
    ...(data.rekeyTo === undefined ? {} : { rekeyTo: data.rekeyTo }),
    ...(data.closeTo === undefined ? {} : { closeTo: data.closeTo }),
    ...(data.closeAmountMicroAlgos === undefined
      ? {}
      : { closeAmountMicroAlgos: data.closeAmountMicroAlgos }),
    ...(data.closeAssetAmount === undefined ? {} : { closeAssetAmount: data.closeAssetAmount }),
    ...(data.clawbackFrom === undefined ? {} : { clawbackFrom: data.clawbackFrom }),
  })
  return { ok: true, model }
}
