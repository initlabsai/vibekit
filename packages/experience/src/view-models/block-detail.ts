import { z } from 'zod'

import { blockDetailDataSchema } from '../blocks.js'
import type { ViewSpec } from '../protocol.js'
import { resolveResultReference, type ResultStore } from '../results.js'
import type { ViewModelError } from './transaction-detail.js'

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
