import { viewDataSchemas } from '@initlabs/vibekit-tools/views'
import { z } from 'zod'

import { uint64JsonSchema } from '../core/algo.js'
import { algorandAddressCandidateSchema } from '../core/classifier.js'
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
import { record, viewModelFor } from './derive.js'

const optionalAddress = z.string().min(1).optional()

/** Counts of each transaction type in a block (pay, axfer, appl, …). */
export const blockTransactionTypeCountSchema = z
  .object({
    type: z.string().min(1),
    count: z.number().int().nonnegative(),
  })
  .strict()

/** Authoritative block data required by the trusted block detail view. */
export const blockDetailDataSchema = z
  .object({
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
  .strict()

/** Authoritative block data required by the trusted block detail view. */
export type BlockDetailData = z.infer<typeof blockDetailDataSchema>

/** One block header row. */
export const blockRowSchema = z
  .object({
    round: z.number().int().nonnegative(),
    timestamp: z.number().int().nonnegative(),
    transactionCount: z.number().int().nonnegative(),
    proposer: optionalAddress,
  })
  .strict()

/** A page of block headers. */
export const blockListDataSchema = z
  .object({
    blocks: z.array(blockRowSchema),
    nextToken: z.string().min(1).optional(),
  })
  .strict()

export type BlockListData = z.infer<typeof blockListDataSchema>

/** The capability of looking a block up as an authoritative record. */
export interface BlockLookupHost {
  lookupBlock(round: number): Promise<StructuredResult>
}

/** Wraps a lookup_block result as a block detail record. */
export function buildBlockDetailRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_block',
): StructuredResult {
  const block = viewDataSchemas['block.detail'].parse(wire)
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName,
    network: identity.network,
    data: blockDetailDataSchema.parse({
      round: block.round,
      timestamp: block.timestamp,
      transactionCount: block.transactionCount,
      ...(block.proposer === undefined ? {} : { proposer: block.proposer }),
      ...(block.feesCollectedMicroAlgos === undefined
        ? {}
        : { feesCollectedMicroAlgos: block.feesCollectedMicroAlgos }),
      ...(block.proposerPayoutMicroAlgos === undefined
        ? {}
        : { proposerPayoutMicroAlgos: block.proposerPayoutMicroAlgos }),
      ...(block.round > 0 ? { previousRound: block.round - 1 } : {}),
      nextRound: block.round + 1,
      transactionTypes: block.transactionTypes,
    }),
  })
}

/** Wraps search_block_headers. */
export function buildBlockListRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_block_headers',
): StructuredResult {
  const page = viewDataSchemas['block.list'].parse(wire)
  return record(
    identity,
    toolName,
    blockListDataSchema.parse({
      blocks: page.blocks,
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

/** Renderer-ready semantic model for the trusted block detail view. */
export const blockDetailViewModelSchema = z
  .object({
    view: z.literal('block.detail'),
    network: z.string().min(1),
    round: z.number().int().nonnegative(),
    timestamp: z.number().int().nonnegative(),
    transactionCount: z.number().int().nonnegative(),
    proposer: z.string().optional(),
    feesCollectedMicroAlgos: blockDetailDataSchema.shape.feesCollectedMicroAlgos,
    proposerPayoutMicroAlgos: blockDetailDataSchema.shape.proposerPayoutMicroAlgos,
    previousRound: z.number().int().nonnegative().optional(),
    nextRound: z.number().int().nonnegative().optional(),
    transactionTypes: blockDetailDataSchema.shape.transactionTypes,
  })
  .strict()

/** Renderer-ready semantic model for the trusted block detail view. */
export type BlockDetailViewModel = z.infer<typeof blockDetailViewModelSchema>

/** Result of deriving the renderer-ready block detail model. */
export type BlockDetailViewModelResult =
  { ok: true; model: BlockDetailViewModel } | { ok: false; error: ViewModelError }

/** Derives block presentation from one trusted result reference. */
export function createBlockDetailViewModel(
  store: ResultStore,
  view: ViewSpec,
): BlockDetailViewModelResult {
  const resolution = resolveResultReference(store, view.source)
  if (!resolution.ok) return resolution

  const parsed = blockDetailDataSchema.safeParse(resolution.value)
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_VIEW_DATA',
        message: 'Block result did not match the trusted block schema',
      },
    }
  }
  return {
    ok: true,
    model: blockDetailViewModelSchema.parse({
      view: 'block.detail',
      network: resolution.record.network,
      ...parsed.data,
    }),
  }
}

export const createBlockListViewModel = viewModelFor(blockListDataSchema, 'block.list' as const, 'Block list')

export type BlockListViewModel = Extract<ReturnType<typeof createBlockListViewModel>, { ok: true }>['model']

/** Formats a unix timestamp as an ISO-8601 UTC string for card copy. */
export function formatBlockTime(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString()
}

/** Lora-style UTC timestamp for explorer cards. */
export function formatExplorerTime(timestamp: number): string {
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
