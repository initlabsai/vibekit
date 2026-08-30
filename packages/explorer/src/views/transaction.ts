import { viewDataSchemas } from '@initlabs/vibekit/tools/views'
import { z } from 'zod'

import { uint64JsonSchema } from '../format.js'
import { algorandAddressCandidateSchema, algorandTransactionIdSchema } from '../input.js'
import type { ViewSpec } from '@initlabs/vibekit/actions'
import type {
  ResultIdentity,
  ResultStore,
  StructuredResult,
  ViewModelError,
} from '@initlabs/vibekit/actions'
import { derive, record, viewModelFor } from './derive.js'

const optionalAddress = z.string().min(1).optional()

/** Acfg asset parameters carried by a transaction detail record. */
export const transactionAssetConfigDataSchema = z.object({
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

/** One app state change as the indexer reports it (action 1 bytes, 2 uint, 3 delete). */
export const stateDeltaEntrySchema = z.object({
  key: z.string(),
  value: z.object({
    action: z.number().int(),
    bytes: z.string().optional(),
    uint: uint64JsonSchema.optional(),
  }),
})

export const localStateDeltaSchema = z.array(
  z.object({ address: z.string(), delta: z.array(stateDeltaEntrySchema) }),
)

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
  /** Printable note text (base64 when the bytes are not printable). */
  note?: string
  closeTo?: string
  closeAmountMicroAlgos?: string | number
  closeAssetAmount?: string | number
  clawbackFrom?: string
  rekeyTo?: string
  freezeTarget?: string
  frozen?: boolean
  assetConfig?: z.infer<typeof transactionAssetConfigDataSchema>
  createdAssetId?: string | number
  createdApplicationId?: string | number
  logs?: string[]
  applicationArgs?: string[]
  methodName?: string
  methodArgs?: Array<{ name?: string; type: string; value?: unknown }>
  methodReturn?: unknown
  innerTxns?: TransactionRowData[]
}

export const transactionRowSchema: z.ZodType<TransactionRowData> = z.object({
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
  note: z.string().min(1).optional(),
  assetDecimals: z.number().int().nonnegative().optional(),
  applicationId: uint64JsonSchema.optional(),
  confirmedRound: z.number().int().nonnegative().optional(),
  roundTime: z.number().int().nonnegative().optional(),
  innerCount: z.number().int().nonnegative().optional(),
  closeTo: optionalAddress,
  closeAmountMicroAlgos: uint64JsonSchema.optional(),
  closeAssetAmount: uint64JsonSchema.optional(),
  clawbackFrom: optionalAddress,
  // Graph rows need this: a zero payment carrying rekeyTo is the rekey itself.
  rekeyTo: optionalAddress,
  freezeTarget: optionalAddress,
  frozen: z.boolean().optional(),
  assetConfig: transactionAssetConfigDataSchema.optional(),
  createdAssetId: uint64JsonSchema.optional(),
  createdApplicationId: uint64JsonSchema.optional(),
  logs: z.array(z.string()).optional(),
  applicationArgs: z.array(z.string()).optional(),
  methodName: z.string().min(1).optional(),
  methodArgs: z
    .array(
      z.object({
        name: z.string().min(1).optional(),
        type: z.string().min(1),
        value: z.unknown().optional(),
      }),
    )
    .optional(),
  methodReturn: z.unknown().optional(),
  innerTxns: z.array(z.lazy((): z.ZodType<TransactionRowData> => transactionRowSchema)).optional(),
})

/**
 * Authoritative transaction data behind the transaction.detail view.
 * Extra wire fields are dropped.
 */
export const transactionDetailDataSchema = z.object({
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
  applicationAccounts: z.array(algorandAddressCandidateSchema).optional(),
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
  logs: z.array(z.string()).optional(),
  applicationArgs: z.array(z.string()).optional(),
  methodName: z.string().min(1).optional(),
  methodArgs: z
    .array(
      z.object({
        name: z.string().min(1).optional(),
        type: z.string().min(1),
        value: z.unknown().optional(),
      }),
    )
    .optional(),
  methodReturn: z.unknown().optional(),
  globalStateDelta: z.array(stateDeltaEntrySchema).optional(),
  localStateDelta: localStateDeltaSchema.optional(),
  // Inner rows, so the detail view can draw the same flow graph as a group.
  innerTxns: z.array(transactionRowSchema).optional(),
})

/** Authoritative transaction data behind the transaction.detail view. */
export type TransactionDetailData = z.infer<typeof transactionDetailDataSchema>

/** A page of transactions, optionally scoped to a group id or account. */
export const transactionCollectionDataSchema = z.object({
  groupId: z.string().min(1).optional(),
  address: optionalAddress,
  transactions: z.array(transactionRowSchema),
  nextToken: z.string().min(1).optional(),
  /** The filter the search ran with, when it had one. */
  query: z
    .object({
      address: z.string().optional(),
      txType: z.string().optional(),
      assetId: z.number().optional(),
      applicationId: z.number().optional(),
      minRound: z.number().optional(),
      maxRound: z.number().optional(),
      notePrefix: z.string().optional(),
    })
    .optional(),
})

/** What a host transaction search is scoped to; `address` routes to the account search. */
export interface TransactionSearchFilter {
  address?: string
  assetId?: number
  applicationId?: number
  round?: number
  txType?: string
  nextToken?: string
}

export type TransactionCollectionData = z.infer<typeof transactionCollectionDataSchema>

/** Wraps a lookup_transaction result as a transaction detail record. */
export function buildTransactionDetailRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_transaction',
): StructuredResult {
  const txn = viewDataSchemas['transaction.detail'].parse(wire)
  const data = transactionDetailDataSchema.parse({
    ...txn,
    type: txn.type ?? 'txn',
    status: txn.confirmedRound === undefined ? 'pending' : 'confirmed',
    ...(txn.innerTxns?.length ? { innerCount: txn.innerTxns.length } : {}),
  })
  return record(identity, toolName, {
    ...data,
    ...(data.innerTxns ? { innerTxns: data.innerTxns.map(withInnerCounts) } : {}),
  })
}

/** Rows carry inner transactions on the wire; the stored row also states their count. */
function withInnerCounts(row: TransactionRowData): TransactionRowData {
  if (!row.innerTxns?.length) return row
  return {
    ...row,
    innerCount: row.innerTxns.length,
    innerTxns: row.innerTxns.map(withInnerCounts),
  }
}

/** Wraps search_transactions / search_account_transactions / search_asset_transactions. */
export function buildTransactionListRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_transactions',
): StructuredResult {
  const page = transactionCollectionDataSchema.parse(wire)
  return record(identity, toolName, {
    ...page,
    transactions: page.transactions.map(withInnerCounts),
  })
}

/** Wraps lookup_transaction_group. */
export function buildTransactionGroupRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_transaction_group',
): StructuredResult {
  return buildTransactionListRecord(identity, wire, toolName)
}

/** Derives transaction presentation from one trusted result reference. */
export const createTransactionDetailViewModel = viewModelFor(
  transactionDetailDataSchema,
  'transaction.detail' as const,
  'Transaction result',
)

export type TransactionDetailViewModel = Extract<
  ReturnType<typeof createTransactionDetailViewModel>,
  { ok: true }
>['model']

/** Derives a transaction list or group model. */
export function createTransactionCollectionViewModel(
  store: ResultStore,
  view: ViewSpec,
): ReturnType<
  typeof derive<typeof transactionCollectionDataSchema, 'transaction.list' | 'transaction.group'>
> {
  const viewId = view.view === 'transaction.group' ? 'transaction.group' : 'transaction.list'
  return derive(store, view, transactionCollectionDataSchema, viewId, 'Transaction collection')
}

export type TransactionCollectionViewModel = Extract<
  ReturnType<typeof createTransactionCollectionViewModel>,
  { ok: true }
>['model']

export type { TransactionLookupHost } from '../host.js'
