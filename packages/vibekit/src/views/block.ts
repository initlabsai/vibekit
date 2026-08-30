import { z } from 'zod'

import { uint64JsonSchema } from './format.js'
import { algorandAddressCandidateSchema } from './input.js'
import type { ResultIdentity, StructuredResult } from '../actions/index.js'
import { createRecord, viewModelFor } from './derive.js'

const optionalAddress = z.string().min(1).optional()

/** Counts of each transaction type in a block (pay, axfer, appl, …). */
export const blockTransactionTypeCountSchema = z.object({
  type: z.string().min(1),
  count: z.number().int().nonnegative(),
})

/**
 * Authoritative block data required by the trusted block detail view.
 * Extra wire fields are dropped.
 */
export const blockDetailDataSchema = z.object({
  round: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative(),
  transactionCount: z.number().int().nonnegative(),
  proposer: algorandAddressCandidateSchema.optional(),
  feesCollectedMicroAlgos: uint64JsonSchema.optional(),
  proposerPayoutMicroAlgos: uint64JsonSchema.optional(),
  previousRound: z.number().int().nonnegative().optional(),
  nextRound: z.number().int().nonnegative().optional(),
  transactionTypes: z.array(blockTransactionTypeCountSchema).default([]),
})

/** Authoritative block data required by the trusted block detail view. */
export type BlockDetailData = z.infer<typeof blockDetailDataSchema>

/** One block header row. */
export const blockRowSchema = z.object({
  round: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative(),
  transactionCount: z.number().int().nonnegative(),
  proposer: optionalAddress,
  transactionTypes: z.array(blockTransactionTypeCountSchema).optional(),
})

/** A page of block headers. */
export const blockListDataSchema = z.object({
  blocks: z.array(blockRowSchema),
  nextToken: z.string().min(1).optional(),
})

export type BlockListData = z.infer<typeof blockListDataSchema>

/** Wraps a lookup_block result as a block detail record; prev/next rounds derive from the round. */
export function buildBlockDetailRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_block',
): StructuredResult {
  const block = blockDetailDataSchema.parse(wire)
  return createRecord(identity, toolName, {
    ...block,
    ...(block.round > 0 ? { previousRound: block.round - 1 } : {}),
    nextRound: block.round + 1,
  })
}

/** Wraps search_block_headers. */
export function buildBlockListRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_block_headers',
): StructuredResult {
  return createRecord(identity, toolName, blockListDataSchema.parse(wire))
}

/** Derives block presentation from one trusted result reference. */
export const createBlockDetailViewModel = viewModelFor(
  blockDetailDataSchema,
  'block.detail' as const,
  'Block detail',
)
export const createBlockListViewModel = viewModelFor(
  blockListDataSchema,
  'block.list' as const,
  'Block list',
)

/** Renderer-ready semantic model for the trusted block detail view. */
export type BlockDetailViewModel = Extract<
  ReturnType<typeof createBlockDetailViewModel>,
  { ok: true }
>['model']
export type BlockListViewModel = Extract<
  ReturnType<typeof createBlockListViewModel>,
  { ok: true }
>['model']

/** Formats a unix timestamp as an ISO-8601 UTC string for card copy. */
export function formatBlockTime(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString()
}

/** Lora-style UTC timestamp for explorer cards. */
export function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toUTCString().replace(/GMT$/, 'UTC')
}

/** Lora transaction-type badges, used on list and block cards. */
const TXN_TYPE_LABEL: Record<string, string> = {
  pay: 'Payment',
  axfer: 'Asset Transfer',
  acfg: 'Asset Config',
  afrz: 'Asset Freeze',
  appl: 'Application Call',
  keyreg: 'Key Registration',
  stpf: 'State Proof',
  hb: 'Heartbeat',
}

/** Human label for an Algorand transaction type code. */
export function formatBlockTxnType(type: string): string {
  return TXN_TYPE_LABEL[type] ?? type
}

const ON_COMPLETION_LABEL: Record<string, string> = {
  noop: 'NoOp',
  optin: 'Opt-In',
  closeout: 'Close Out',
  clear: 'Clear State',
  update: 'Update',
  delete: 'Delete',
}

/** Lora on-completion labels for application-call cards. */
export function formatOnCompletion(value: string): string {
  return ON_COMPLETION_LABEL[value.toLowerCase()] ?? value
}

export type { BlockLookupHost } from './host.js'

/** What a block-tail watch matched in a round. */
export type BlockTailMatch =
  | { kind: 'account'; address: string }
  | { kind: 'asset'; assetId: number }
  | { kind: 'application'; applicationId: number }

/** One confirmed round as a feed-ready pair of records, plus the matches a watch asked for. */
export interface BlockTailTick {
  round: number
  timestamp: number
  block: StructuredResult
  transactions: StructuredResult
  related: BlockTailMatch[]
}
