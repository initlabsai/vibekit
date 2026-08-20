import { viewDataSchemas, type ViewData } from '@initlabs/vibekit-tools/views'
import { z } from 'zod'

import { uint64JsonSchema } from '../core/algo.js'
import { algorandAddressCandidateSchema, algorandTransactionIdSchema } from '../core/classifier.js'
import type { ViewSpec } from '../core/protocol.js'
import {
  resolveResultReference,
  structuredResultSchema,
  type ResultIdentity,
  type ResultStore,
  type StructuredResult,
  type ViewModelError,
} from '../core/results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from '../core/version.js'
import { addressEnvelopeSchema, derive, record } from './derive.js'

const optionalAddress = z.string().min(1).optional()

/** Acfg asset parameters carried by a transaction detail record. */
export const transactionAssetConfigDataSchema = z
  .object({
    total: uint64JsonSchema.optional(),
    decimals: z.number().int().nonnegative().optional(),
    unitName: z.string().min(1).optional(),
    assetName: z.string().min(1).optional(),
    url: z.string().min(1).optional(),
    manager: algorandAddressCandidateSchema.optional(),
    reserve: algorandAddressCandidateSchema.optional(),
    freeze: algorandAddressCandidateSchema.optional(),
    clawback: algorandAddressCandidateSchema.optional(),
    defaultFrozen: z.boolean().optional(),
  })
  .strict()

/** Authoritative transaction data required by the first trusted detail view. */
export const transactionDetailDataSchema = z
  .object({
    id: algorandTransactionIdSchema,
    type: z.string().min(1),
    status: z.enum(['confirmed', 'pending', 'failed']),
    sender: algorandAddressCandidateSchema,
    receiver: algorandAddressCandidateSchema.optional(),
    feeMicroAlgos: uint64JsonSchema,
    confirmedRound: z.number().int().nonnegative().optional(),
    roundTime: z.number().int().nonnegative().optional(),
    paymentAmountMicroAlgos: uint64JsonSchema.optional(),
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
    freezeTarget: algorandAddressCandidateSchema.optional(),
    frozen: z.boolean().optional(),
    assetConfig: transactionAssetConfigDataSchema.optional(),
    createdAssetId: uint64JsonSchema.optional(),
    createdApplicationId: uint64JsonSchema.optional(),
    signer: algorandAddressCandidateSchema.optional(),
  })
  .strict()

/** Authoritative transaction data required by the first trusted detail view. */
export type TransactionDetailData = z.infer<typeof transactionDetailDataSchema>

/**
 * One transaction row in a list or group. Rows nest recursively and carry
 * everything the trusted flow-graph card renders (close-outs, clawbacks,
 * freezes, created ids, signer) — a stored record must hold what its view
 * shows.
 */
export interface TransactionRowData {
  id?: string
  type?: string
  sender: string
  receiver?: string
  signer?: string
  paymentAmountMicroAlgos?: string | number
  feeMicroAlgos?: string | number
  assetId?: string | number
  assetAmount?: string | number
  assetName?: string
  assetUnitName?: string
  assetDecimals?: number
  applicationId?: string | number
  confirmedRound?: number
  roundTime?: number
  innerCount?: number
  closeTo?: string
  closeAmountMicroAlgos?: string | number
  closeAssetAmount?: string | number
  clawbackFrom?: string
  freezeTarget?: string
  frozen?: boolean
  assetConfig?: z.infer<typeof transactionAssetConfigDataSchema>
  createdAssetId?: string | number
  createdApplicationId?: string | number
  innerTxns?: TransactionRowData[]
}

export const transactionRowSchema: z.ZodType<TransactionRowData> = z
  .object({
    id: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
    sender: z.string().min(1),
    receiver: optionalAddress,
    signer: optionalAddress,
    paymentAmountMicroAlgos: uint64JsonSchema.optional(),
    feeMicroAlgos: uint64JsonSchema.optional(),
    assetId: uint64JsonSchema.optional(),
    assetAmount: uint64JsonSchema.optional(),
    assetName: z.string().min(1).optional(),
    assetUnitName: z.string().min(1).optional(),
    assetDecimals: z.number().int().nonnegative().optional(),
    applicationId: uint64JsonSchema.optional(),
    confirmedRound: z.number().int().nonnegative().optional(),
    roundTime: z.number().int().nonnegative().optional(),
    innerCount: z.number().int().nonnegative().optional(),
    closeTo: optionalAddress,
    closeAmountMicroAlgos: uint64JsonSchema.optional(),
    closeAssetAmount: uint64JsonSchema.optional(),
    clawbackFrom: optionalAddress,
    freezeTarget: optionalAddress,
    frozen: z.boolean().optional(),
    assetConfig: transactionAssetConfigDataSchema.optional(),
    createdAssetId: uint64JsonSchema.optional(),
    createdApplicationId: uint64JsonSchema.optional(),
    innerTxns: z
      .array(z.lazy((): z.ZodType<TransactionRowData> => transactionRowSchema))
      .optional(),
  })
  .strict()

/** A page of transactions, optionally scoped to a group id or account. */
export const transactionCollectionDataSchema = z
  .object({
    groupId: z.string().min(1).optional(),
    address: optionalAddress,
    transactions: z.array(transactionRowSchema),
    nextToken: z.string().min(1).optional(),
  })
  .strict()

export type TransactionCollectionData = z.infer<typeof transactionCollectionDataSchema>

/** Wraps a lookup_transaction result as a transaction detail record. */
export function buildTransactionDetailRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_transaction',
): StructuredResult {
  const txn = viewDataSchemas['transaction.detail'].parse(wire)
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName,
    network: identity.network,
    data: transactionDetailDataSchema.parse({
      id: txn.id,
      type: txn.type ?? 'txn',
      status: txn.confirmedRound === undefined ? 'pending' : 'confirmed',
      sender: txn.sender,
      feeMicroAlgos: txn.feeMicroAlgos,
      ...(txn.receiver === undefined ? {} : { receiver: txn.receiver }),
      ...(txn.paymentAmountMicroAlgos === undefined
        ? {}
        : { paymentAmountMicroAlgos: txn.paymentAmountMicroAlgos }),
      ...(txn.confirmedRound === undefined ? {} : { confirmedRound: txn.confirmedRound }),
      ...(txn.roundTime === undefined ? {} : { roundTime: txn.roundTime }),
      ...(txn.assetId === undefined ? {} : { assetId: txn.assetId }),
      ...(txn.assetAmount === undefined ? {} : { assetAmount: txn.assetAmount }),
      ...(txn.assetName === undefined ? {} : { assetName: txn.assetName }),
      ...(txn.assetUnitName === undefined ? {} : { assetUnitName: txn.assetUnitName }),
      ...(txn.assetDecimals === undefined ? {} : { assetDecimals: txn.assetDecimals }),
      ...(txn.applicationId === undefined ? {} : { applicationId: txn.applicationId }),
      ...(txn.onCompletion === undefined ? {} : { onCompletion: txn.onCompletion }),
      ...(txn.note === undefined ? {} : { note: txn.note }),
      ...(txn.group === undefined ? {} : { group: txn.group }),
      ...(txn.innerTxns && txn.innerTxns.length > 0 ? { innerCount: txn.innerTxns.length } : {}),
      ...(txn.rekeyTo === undefined ? {} : { rekeyTo: txn.rekeyTo }),
      ...(txn.closeTo === undefined ? {} : { closeTo: txn.closeTo }),
      ...(txn.closeAmountMicroAlgos === undefined
        ? {}
        : { closeAmountMicroAlgos: txn.closeAmountMicroAlgos }),
      ...(txn.closeAssetAmount === undefined ? {} : { closeAssetAmount: txn.closeAssetAmount }),
      ...(txn.clawbackFrom === undefined ? {} : { clawbackFrom: txn.clawbackFrom }),
      ...(txn.freezeTarget === undefined ? {} : { freezeTarget: txn.freezeTarget }),
      ...(txn.frozen === undefined ? {} : { frozen: txn.frozen }),
      ...(txn.assetConfig === undefined ? {} : { assetConfig: txn.assetConfig }),
      ...(txn.createdAssetId === undefined ? {} : { createdAssetId: txn.createdAssetId }),
      ...(txn.createdApplicationId === undefined
        ? {}
        : { createdApplicationId: txn.createdApplicationId }),
      ...(txn.signer === undefined ? {} : { signer: txn.signer }),
    }),
  })
}

/** The capability of looking a transaction up as an authoritative record. */
export interface TransactionLookupHost {
  lookupTransaction(txid: string): Promise<StructuredResult>
  /** Looks every transaction in an atomic group up as one transaction.group record. */
  lookupTransactionGroup(groupId: string): Promise<StructuredResult>
}

function txnRow(
  wire: ViewData<'transaction.list'>['transactions'][number],
): z.infer<typeof transactionRowSchema> {
  const innerCount = wire.innerTxns?.length
  return {
    sender: wire.sender,
    feeMicroAlgos: wire.feeMicroAlgos,
    ...(wire.id === undefined ? {} : { id: wire.id }),
    ...(wire.type === undefined ? {} : { type: wire.type }),
    ...(wire.receiver === undefined ? {} : { receiver: wire.receiver }),
    ...(wire.signer === undefined ? {} : { signer: wire.signer }),
    ...(wire.paymentAmountMicroAlgos === undefined
      ? {}
      : { paymentAmountMicroAlgos: wire.paymentAmountMicroAlgos }),
    ...(wire.assetId === undefined ? {} : { assetId: wire.assetId }),
    ...(wire.assetAmount === undefined ? {} : { assetAmount: wire.assetAmount }),
    ...(wire.assetName === undefined ? {} : { assetName: wire.assetName }),
    ...(wire.assetUnitName === undefined ? {} : { assetUnitName: wire.assetUnitName }),
    ...(wire.assetDecimals === undefined ? {} : { assetDecimals: wire.assetDecimals }),
    ...(wire.applicationId === undefined ? {} : { applicationId: wire.applicationId }),
    ...(wire.confirmedRound === undefined ? {} : { confirmedRound: wire.confirmedRound }),
    ...(wire.roundTime === undefined ? {} : { roundTime: wire.roundTime }),
    ...(innerCount ? { innerCount } : {}),
    ...(wire.closeTo === undefined ? {} : { closeTo: wire.closeTo }),
    ...(wire.closeAmountMicroAlgos === undefined
      ? {}
      : { closeAmountMicroAlgos: wire.closeAmountMicroAlgos }),
    ...(wire.closeAssetAmount === undefined ? {} : { closeAssetAmount: wire.closeAssetAmount }),
    ...(wire.clawbackFrom === undefined ? {} : { clawbackFrom: wire.clawbackFrom }),
    ...(wire.freezeTarget === undefined ? {} : { freezeTarget: wire.freezeTarget }),
    ...(wire.frozen === undefined ? {} : { frozen: wire.frozen }),
    ...(wire.assetConfig === undefined ? {} : { assetConfig: wire.assetConfig }),
    ...(wire.createdAssetId === undefined ? {} : { createdAssetId: wire.createdAssetId }),
    ...(wire.createdApplicationId === undefined
      ? {}
      : { createdApplicationId: wire.createdApplicationId }),
    ...(wire.innerTxns && wire.innerTxns.length > 0
      ? // Inner transactions share the outer wire shape; the subpath's
        // inferred type flattens the recursion to Record<string, unknown>.
        { innerTxns: wire.innerTxns.map((inner) => txnRow(inner as typeof wire)) }
      : {}),
  }
}

/** Wraps search_transactions / search_account_transactions / search_asset_transactions. */
export function buildTransactionListRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_transactions',
): StructuredResult {
  const page = viewDataSchemas['transaction.list'].parse(wire)
  const { address } = addressEnvelopeSchema.parse(wire)
  return record(
    identity,
    toolName,
    transactionCollectionDataSchema.parse({
      transactions: page.transactions.map(txnRow),
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
      ...(address === undefined ? {} : { address }),
    }),
  )
}

/** Wraps lookup_transaction_group. */
export function buildTransactionGroupRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_transaction_group',
): StructuredResult {
  const page = viewDataSchemas['transaction.group'].parse(wire)
  return record(
    identity,
    toolName,
    transactionCollectionDataSchema.parse({
      transactions: page.transactions.map(txnRow),
      groupId: page.groupId,
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

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
    freezeTarget: algorandAddressCandidateSchema.optional(),
    frozen: z.boolean().optional(),
    assetConfig: transactionAssetConfigDataSchema.optional(),
    createdAssetId: uint64JsonSchema.optional(),
    createdApplicationId: uint64JsonSchema.optional(),
    signer: algorandAddressCandidateSchema.optional(),
  })
  .strict()

/** Renderer-ready semantic model for the trusted transaction detail view. */
export type TransactionDetailViewModel = z.infer<typeof transactionDetailViewModelSchema>

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
    ...(data.freezeTarget === undefined ? {} : { freezeTarget: data.freezeTarget }),
    ...(data.frozen === undefined ? {} : { frozen: data.frozen }),
    ...(data.assetConfig === undefined ? {} : { assetConfig: data.assetConfig }),
    ...(data.createdAssetId === undefined ? {} : { createdAssetId: data.createdAssetId }),
    ...(data.createdApplicationId === undefined
      ? {}
      : { createdApplicationId: data.createdApplicationId }),
    ...(data.signer === undefined ? {} : { signer: data.signer }),
  })
  return { ok: true, model }
}

/** Derives a transaction list or group model. */
export function createTransactionCollectionViewModel(
  store: ResultStore,
  view: ViewSpec,
): ReturnType<typeof derive<typeof transactionCollectionDataSchema, 'transaction.list' | 'transaction.group'>> {
  const viewId = view.view === 'transaction.group' ? 'transaction.group' : 'transaction.list'
  return derive(
    store,
    view,
    transactionCollectionDataSchema,
    viewId,
    'Transaction collection did not match the trusted schema',
  )
}

export type TransactionCollectionViewModel = Extract<
  ReturnType<typeof createTransactionCollectionViewModel>,
  { ok: true }
>['model']
