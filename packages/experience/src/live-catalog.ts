import { viewDataSchemas, type ViewData } from '@initlabs/vibekit-tools/views'
import { z } from 'zod'

import {
  accountListDataSchema,
  accountSummaryDataSchema,
  applicationBoxDataSchema,
  applicationListDataSchema,
  applicationLocalsDataSchema,
  applicationLogsDataSchema,
  applicationStateDataSchema,
  assetHoldersDataSchema,
  assetHoldingsDataSchema,
  assetListDataSchema,
  blockListDataSchema,
  transactionCollectionDataSchema,
} from './catalog.js'
import type { ResultIdentity } from './live-payment.js'
import { structuredResultSchema, type StructuredResult } from './results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from './version.js'

function record(
  identity: ResultIdentity,
  toolName: string,
  data: unknown,
): StructuredResult {
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName,
    network: identity.network,
    data,
  })
}

/**
 * Hosts scope some list wires to an account by merging an `address` key into
 * the tool result; the tools schemas know nothing about it, so it is parsed
 * beside them.
 */
const addressEnvelopeSchema = z.object({ address: z.string().min(1).optional() })

function txnRow(wire: ViewData<'transaction.list'>['transactions'][number]) {
  const innerCount = wire.innerTxns?.length
  return {
    sender: wire.sender,
    feeMicroAlgos: wire.feeMicroAlgos,
    ...(wire.id === undefined ? {} : { id: wire.id }),
    ...(wire.type === undefined ? {} : { type: wire.type }),
    ...(wire.receiver === undefined ? {} : { receiver: wire.receiver }),
    ...(wire.paymentAmountMicroAlgos === undefined
      ? {}
      : { paymentAmountMicroAlgos: wire.paymentAmountMicroAlgos }),
    ...(wire.assetId === undefined ? {} : { assetId: wire.assetId }),
    ...(wire.assetAmount === undefined ? {} : { assetAmount: wire.assetAmount }),
    ...(wire.applicationId === undefined ? {} : { applicationId: wire.applicationId }),
    ...(wire.confirmedRound === undefined ? {} : { confirmedRound: wire.confirmedRound }),
    ...(wire.roundTime === undefined ? {} : { roundTime: wire.roundTime }),
    ...(innerCount ? { innerCount } : {}),
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

/** Wraps search_assets. */
export function buildAssetListRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_assets',
): StructuredResult {
  const page = viewDataSchemas['asset.list'].parse(wire)
  return record(
    identity,
    toolName,
    assetListDataSchema.parse({
      assets: page.assets.map((asset) => ({
        assetId: asset.assetId,
        totalSupply: asset.totalSupply,
        decimals: asset.decimals,
        ...(asset.name === undefined ? {} : { name: asset.name }),
        ...(asset.unitName === undefined ? {} : { unitName: asset.unitName }),
        ...(asset.creator === undefined ? {} : { creator: asset.creator }),
      })),
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

/** Wraps get_account_assets. */
export function buildAssetHoldingsRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'get_account_assets',
): StructuredResult {
  const page = viewDataSchemas['asset.holdings'].parse(wire)
  return record(
    identity,
    toolName,
    assetHoldingsDataSchema.parse({
      assets: page.assets,
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

/** Wraps search_asset_balances. */
export function buildAssetHoldersRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_asset_balances',
): StructuredResult {
  const page = viewDataSchemas['asset.holders'].parse(wire)
  return record(
    identity,
    toolName,
    assetHoldersDataSchema.parse({
      balances: page.balances,
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

/** Wraps search_applications. */
export function buildApplicationListRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_applications',
): StructuredResult {
  const page = viewDataSchemas['application.list'].parse(wire)
  return record(
    identity,
    toolName,
    applicationListDataSchema.parse({
      applications: page.applications.map((application) => ({
        applicationId: application.applicationId,
        ...(application.creator === undefined ? {} : { creator: application.creator }),
        globalStateCount: application.globalState?.length ?? 0,
      })),
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

/** Wraps read_global_state and read_local_state (the unified scope shape). */
export function buildApplicationStateRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'read_global_state',
): StructuredResult {
  const single = viewDataSchemas['application.state'].parse(wire)
  return record(
    identity,
    toolName,
    applicationStateDataSchema.parse({
      applicationId: single.appId,
      scope: single.scope,
      ...(single.address === undefined ? {} : { address: single.address }),
      ...(single.optedIn === undefined ? {} : { optedIn: single.optedIn }),
      entries: single.state.map((entry) => ({
        key: entry.key,
        value: String(entry.value),
        type: entry.type,
      })),
    }),
  )
}

type LocalKeyValue =
  ViewData<'application.locals'>['appLocalStates'][number]['keyValue'][number]

function localStateEntry(entry: LocalKeyValue) {
  // Algod state types: 1 = bytes, 2 = uint.
  if (entry.value.type === 2 || entry.value.uint !== undefined) {
    return { key: entry.key, value: String(entry.value.uint ?? 0), type: 'uint' as const }
  }
  return { key: entry.key, value: entry.value.bytes ?? '', type: 'bytes' as const }
}

/** Wraps get_account_app_local_states. */
export function buildApplicationLocalsRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'get_account_app_local_states',
): StructuredResult {
  const page = viewDataSchemas['application.locals'].parse(wire)
  const { address } = addressEnvelopeSchema.parse(wire)
  return record(
    identity,
    toolName,
    applicationLocalsDataSchema.parse({
      ...(address === undefined ? {} : { address }),
      apps: page.appLocalStates.map((app) => ({
        applicationId: app.applicationId,
        schema: app.schema,
        entries: app.keyValue.map(localStateEntry),
      })),
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

/** Wraps lookup_application_logs. */
export function buildApplicationLogsRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_application_logs',
): StructuredResult {
  const page = viewDataSchemas['application.logs'].parse(wire)
  return record(
    identity,
    toolName,
    applicationLogsDataSchema.parse({
      applicationId: page.applicationId,
      logData: page.logData,
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

/** Wraps read_box_state. */
export function buildApplicationBoxRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'read_box_state',
): StructuredResult {
  const box = viewDataSchemas['application.box'].parse(wire)
  return record(
    identity,
    toolName,
    applicationBoxDataSchema.parse({
      applicationId: box.appId,
      boxName: box.boxName,
      exists: box.exists,
      ...(box.value === undefined ? {} : { value: box.value }),
      ...(box.size === undefined ? {} : { size: box.size }),
    }),
  )
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
