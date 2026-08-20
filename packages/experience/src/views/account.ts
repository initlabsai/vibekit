import { viewDataSchemas, type ViewData } from '@initlabs/vibekit-tools/views'
import { z } from 'zod'

import { uint64JsonSchema } from '../core/algo.js'
import { algorandAddressCandidateSchema } from '../core/classifier.js'
import type { ExplorerArtifact, ViewSpec } from '../core/protocol.js'
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

/** One asset holding on an account. */
export const accountAssetHoldingSchema = z
  .object({
    assetId: uint64JsonSchema,
    amount: uint64JsonSchema.describe('Base units of the asset'),
    isFrozen: z.boolean(),
    name: z.string().min(1).optional(),
    unitName: z.string().min(1).optional(),
  })
  .strict()

/** Authoritative account data required by the trusted portfolio view. */
export const accountPortfolioDataSchema = z
  .object({
    address: algorandAddressCandidateSchema,
    balanceMicroAlgos: uint64JsonSchema,
    totalAssets: z.number().int().nonnegative(),
    assets: z.array(accountAssetHoldingSchema),
  })
  .strict()

/** Authoritative account data required by the trusted portfolio view. */
export type AccountPortfolioData = z.infer<typeof accountPortfolioDataSchema>

/** Compact account facts for summary and list cards. */
export const accountSummaryDataSchema = z
  .object({
    address: algorandAddressCandidateSchema,
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
  .strict()

/** A page of account summaries. */
export const accountListDataSchema = z
  .object({
    accounts: z.array(accountSummaryDataSchema),
    nextToken: z.string().min(1).optional(),
  })
  .strict()

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
  const portfolio = viewDataSchemas['account.portfolio'].parse(wire)
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName,
    network: identity.network,
    data: accountPortfolioDataSchema.parse(portfolio),
  })
}

/** Builds the titled trusted view that renders a portfolio record. */
export function createAccountArtifact(record: StructuredResult): ExplorerArtifact {
  if (record.state !== 'success') {
    throw new Error('Cannot open a failed account record')
  }
  const data = accountPortfolioDataSchema.parse(record.data)
  const address = data.address
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

function accountSummary(wire: ViewData<'account.summary'>) {
  return accountSummaryDataSchema.parse({
    address: wire.address,
    balanceMicroAlgos: wire.balanceMicroAlgos,
    ...(wire.status === undefined ? {} : { status: wire.status }),
    ...(wire.minBalanceMicroAlgos === undefined
      ? {}
      : { minBalanceMicroAlgos: wire.minBalanceMicroAlgos }),
    ...(wire.rekeyedTo === undefined ? {} : { rekeyedTo: wire.rekeyedTo }),
    ...(wire.totalAssetsOptedIn === undefined ? {} : { totalAssetsOptedIn: wire.totalAssetsOptedIn }),
    ...(wire.totalAppsOptedIn === undefined ? {} : { totalAppsOptedIn: wire.totalAppsOptedIn }),
    ...(wire.totalCreatedAssets === undefined ? {} : { totalCreatedAssets: wire.totalCreatedAssets }),
    ...(wire.totalCreatedApps === undefined ? {} : { totalCreatedApps: wire.totalCreatedApps }),
    ...(wire.createdAtRound === undefined ? {} : { createdAtRound: wire.createdAtRound }),
  })
}

/** Wraps lookup_account. */
export function buildAccountSummaryRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_account',
): StructuredResult {
  return record(identity, toolName, accountSummary(viewDataSchemas['account.summary'].parse(wire)))
}

/** Wraps search_accounts / batch_lookup_accounts. */
export function buildAccountListRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_accounts',
): StructuredResult {
  const page = viewDataSchemas['account.list'].parse(wire)
  return record(
    identity,
    toolName,
    accountListDataSchema.parse({
      accounts: page.accounts.map(accountSummary),
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

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

export const createAccountSummaryViewModel = viewModelFor(accountSummaryDataSchema, 'account.summary' as const, 'Account summary')
export const createAccountListViewModel = viewModelFor(accountListDataSchema, 'account.list' as const, 'Account list')

export type AccountSummaryViewModel = Extract<
  ReturnType<typeof createAccountSummaryViewModel>,
  { ok: true }
>['model']
export type AccountListViewModel = Extract<
  ReturnType<typeof createAccountListViewModel>,
  { ok: true }
>['model']
