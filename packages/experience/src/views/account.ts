import { z } from 'zod'

import { uint64JsonSchema } from '../core/algo.js'
import { algorandAddressCandidateSchema } from '../core/classifier.js'
import type { ExplorerArtifact } from '../core/protocol.js'
import type { ResultIdentity, StructuredResult } from '../core/results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from '../core/version.js'
import { record, viewModelFor } from './derive.js'

/** One asset holding on an account. */
export const accountAssetHoldingSchema = z.object({
  assetId: uint64JsonSchema,
  amount: uint64JsonSchema.describe('Base units of the asset'),
  isFrozen: z.boolean(),
  decimals: z.number().int().nonnegative().optional(),
  name: z.string().min(1).optional(),
  unitName: z.string().min(1).optional(),
})

/**
 * Authoritative account data required by the trusted portfolio view.
 * Extra wire fields are dropped.
 */
export const accountPortfolioDataSchema = z.object({
  address: algorandAddressCandidateSchema,
  balanceMicroAlgos: uint64JsonSchema,
  totalAssets: z.number().int().nonnegative(),
  assets: z.array(accountAssetHoldingSchema),
})

/** Authoritative account data required by the trusted portfolio view. */
export type AccountPortfolioData = z.infer<typeof accountPortfolioDataSchema>

/** Compact account facts for summary and list cards. */
export const accountSummaryDataSchema = z.object({
  address: algorandAddressCandidateSchema,
  // Keystore label overlaid by the host; never on-chain data.
  name: z.string().min(1).optional(),
  balanceMicroAlgos: uint64JsonSchema,
  status: z.string().min(1).optional(),
  minBalanceMicroAlgos: uint64JsonSchema.optional(),
  rekeyedTo: algorandAddressCandidateSchema.optional(),
  totalAssetsOptedIn: z.number().int().nonnegative().optional(),
  totalAppsOptedIn: z.number().int().nonnegative().optional(),
  totalCreatedAssets: z.number().int().nonnegative().optional(),
  totalCreatedApps: z.number().int().nonnegative().optional(),
  createdAtRound: z.number().int().nonnegative().optional(),
})

/** A page of account summaries. */
export const accountListDataSchema = z.object({
  accounts: z.array(accountSummaryDataSchema),
  nextToken: z.string().min(1).optional(),
  /** Requested addresses with no record on this network (batch lookups). */
  missing: z.array(z.string()).optional(),
})

export type AccountSummaryData = z.infer<typeof accountSummaryDataSchema>
export type AccountListData = z.infer<typeof accountListDataSchema>

/** The capability of looking an account up as an authoritative record. */
export interface AccountLookupHost {
  lookupAccount(address: string): Promise<StructuredResult>
  /** Looks several accounts up as one account.list record. */
  lookupAccounts(addresses: readonly string[]): Promise<StructuredResult>
  /** Lists assets held by an account. */
  lookupAccountAssets(address: string): Promise<StructuredResult>
  /** Lists application local state for apps an account has opted into. */
  lookupAccountAppStates(address: string): Promise<StructuredResult>
  /** Lists transactions involving an account. */
  lookupAccountTransactions(address: string): Promise<StructuredResult>
}

/** Wraps a get_account_portfolio result as a portfolio record. */
export function buildAccountPortfolioRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'get_account_portfolio',
): StructuredResult {
  return record(identity, toolName, accountPortfolioDataSchema.parse(wire))
}

/** Builds the titled trusted view that renders a portfolio record. */
export function createAccountArtifact(
  record: StructuredResult,
): ExplorerArtifact {
  if (record.state !== 'success') {
    throw new Error('Cannot open a failed account record')
  }
  const { address } = accountPortfolioDataSchema.parse(record.data)
  return {
    title: `Account ${address.slice(0, 6)}…${address.slice(-4)}`,
    view: {
      protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
      type: 'view',
      view: 'account.portfolio',
      source: { source: 'result', id: record.resultId },
    },
  }
}

/** Wraps lookup_account. */
export function buildAccountSummaryRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_account',
): StructuredResult {
  return record(identity, toolName, accountSummaryDataSchema.parse(wire))
}

/** Wraps search_accounts / batch_lookup_accounts. */
export function buildAccountListRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_accounts',
): StructuredResult {
  return record(identity, toolName, accountListDataSchema.parse(wire))
}

/** Derives account presentation from one trusted result reference. */
export const createAccountPortfolioViewModel = viewModelFor(
  accountPortfolioDataSchema,
  'account.portfolio' as const,
  'Account portfolio',
)
export const createAccountSummaryViewModel = viewModelFor(
  accountSummaryDataSchema,
  'account.summary' as const,
  'Account summary',
)
export const createAccountListViewModel = viewModelFor(
  accountListDataSchema,
  'account.list' as const,
  'Account list',
)

/** Renderer-ready semantic model for the trusted account portfolio view. */
export type AccountPortfolioViewModel = Extract<
  ReturnType<typeof createAccountPortfolioViewModel>,
  { ok: true }
>['model']
export type AccountSummaryViewModel = Extract<
  ReturnType<typeof createAccountSummaryViewModel>,
  { ok: true }
>['model']
export type AccountListViewModel = Extract<
  ReturnType<typeof createAccountListViewModel>,
  { ok: true }
>['model']
