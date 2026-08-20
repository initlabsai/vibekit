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
import { algorandAddressCandidateSchema } from './classifier.js'
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

function microFromAlgo(value: number | undefined): number | undefined {
  if (value === undefined) return undefined
  return Math.round(value * 1_000_000)
}

const txnWireSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  sender: z.string().min(1),
  receiver: z.string().min(1).optional(),
  fee: z.number().optional(),
  paymentAmount: z.number().optional(),
  assetId: z.union([z.number(), z.string()]).optional(),
  assetAmount: z.union([z.number(), z.string()]).optional(),
  applicationId: z.union([z.number(), z.string()]).optional(),
  confirmedRound: z.number().int().nonnegative().optional(),
  roundTime: z.number().int().nonnegative().optional(),
  group: z.string().min(1).optional(),
  innerTxns: z.array(z.unknown()).optional(),
})

function txnRow(wire: z.infer<typeof txnWireSchema>) {
  const payment = microFromAlgo(wire.paymentAmount)
  const innerCount = wire.innerTxns?.length
  return {
    sender: wire.sender,
    ...(wire.id === undefined ? {} : { id: wire.id }),
    ...(wire.type === undefined ? {} : { type: wire.type }),
    ...(wire.receiver === undefined ? {} : { receiver: wire.receiver }),
    ...(payment === undefined ? {} : { paymentAmountMicroAlgos: payment }),
    ...(wire.fee === undefined ? {} : { feeMicroAlgos: microFromAlgo(wire.fee) }),
    ...(wire.assetId === undefined ? {} : { assetId: wire.assetId }),
    ...(wire.assetAmount === undefined ? {} : { assetAmount: wire.assetAmount }),
    ...(wire.applicationId === undefined ? {} : { applicationId: wire.applicationId }),
    ...(wire.confirmedRound === undefined ? {} : { confirmedRound: wire.confirmedRound }),
    ...(wire.roundTime === undefined ? {} : { roundTime: wire.roundTime }),
    ...(innerCount ? { innerCount } : {}),
  }
}

const txnCollectionWireSchema = z.object({
  transactions: z.array(txnWireSchema),
  nextToken: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
})

/** Wraps search_transactions / search_account_transactions / search_asset_transactions. */
export function buildTransactionListRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_transactions',
): StructuredResult {
  const page = txnCollectionWireSchema.parse(wire)
  return record(
    identity,
    toolName,
    transactionCollectionDataSchema.parse({
      transactions: page.transactions.map(txnRow),
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
      ...(page.address === undefined ? {} : { address: page.address }),
    }),
  )
}

/** Wraps lookup_transaction_group. */
export function buildTransactionGroupRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_transaction_group',
): StructuredResult {
  const page = txnCollectionWireSchema.parse(wire)
  const groupId = page.groupId ?? page.transactions.find((txn) => txn.group)?.group
  return record(
    identity,
    toolName,
    transactionCollectionDataSchema.parse({
      transactions: page.transactions.map(txnRow),
      ...(groupId === undefined ? {} : { groupId }),
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

const accountWireSchema = z.object({
  address: algorandAddressCandidateSchema,
  balanceAlgos: z.number().finite().nonnegative(),
  status: z.string().min(1).optional(),
  minBalanceAlgos: z.number().finite().nonnegative().optional(),
  rekeyedTo: algorandAddressCandidateSchema.optional(),
  totalAssetsOptedIn: z.number().int().nonnegative().optional(),
  totalAppsOptedIn: z.number().int().nonnegative().optional(),
  totalCreatedAssets: z.number().int().nonnegative().optional(),
  totalCreatedApps: z.number().int().nonnegative().optional(),
  createdAtRound: z.number().int().nonnegative().optional(),
})

function accountSummary(wire: z.infer<typeof accountWireSchema>) {
  return accountSummaryDataSchema.parse({
    address: wire.address,
    balanceMicroAlgos: Math.round(wire.balanceAlgos * 1_000_000),
    ...(wire.status === undefined ? {} : { status: wire.status }),
    ...(wire.minBalanceAlgos === undefined
      ? {}
      : { minBalanceMicroAlgos: Math.round(wire.minBalanceAlgos * 1_000_000) }),
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
  return record(identity, toolName, accountSummary(accountWireSchema.parse(wire)))
}

/** Wraps search_accounts / batch_lookup_accounts. */
export function buildAccountListRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_accounts',
): StructuredResult {
  const page = z
    .object({
      accounts: z.array(accountWireSchema),
      nextToken: z.string().min(1).optional(),
    })
    .parse(wire)
  return record(
    identity,
    toolName,
    accountListDataSchema.parse({
      accounts: page.accounts.map(accountSummary),
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

const assetRowWireSchema = z.object({
  assetId: z.union([z.number(), z.string()]),
  name: z.string().min(1).optional(),
  unitName: z.string().min(1).optional(),
  totalSupply: z.union([z.string(), z.number()]),
  decimals: z.number().int().nonnegative(),
  creator: z.string().min(1).optional(),
})

/** Wraps search_assets. */
export function buildAssetListRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_assets',
): StructuredResult {
  const page = z
    .object({
      assets: z.array(assetRowWireSchema),
      nextToken: z.string().min(1).optional(),
    })
    .parse(wire)
  return record(
    identity,
    toolName,
    assetListDataSchema.parse({
      assets: page.assets.map((asset) => ({
        assetId: asset.assetId,
        ...(asset.name === undefined ? {} : { name: asset.name }),
        ...(asset.unitName === undefined ? {} : { unitName: asset.unitName }),
        totalSupply: String(asset.totalSupply),
        decimals: asset.decimals,
        ...(asset.creator === undefined ? {} : { creator: asset.creator }),
      })),
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

const assetHoldingWireSchema = z.object({
  assetId: z.union([z.number(), z.string()]),
  amount: z.union([z.string(), z.number()]),
  isFrozen: z.boolean(),
  name: z.string().min(1).optional(),
  unitName: z.string().min(1).optional(),
})

/** Wraps get_account_assets. */
export function buildAssetHoldingsRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'get_account_assets',
): StructuredResult {
  const page = z
    .object({
      assets: z.array(assetHoldingWireSchema),
      nextToken: z.string().min(1).optional(),
    })
    .parse(wire)
  return record(
    identity,
    toolName,
    assetHoldingsDataSchema.parse({
      assets: page.assets.map((asset) => ({
        assetId: asset.assetId,
        amount: String(asset.amount),
        isFrozen: asset.isFrozen,
        ...(asset.name === undefined ? {} : { name: asset.name }),
        ...(asset.unitName === undefined ? {} : { unitName: asset.unitName }),
      })),
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
  const page = z
    .object({
      balances: z.array(
        z.object({
          address: z.string().min(1),
          amount: z.union([z.string(), z.number()]),
          isFrozen: z.boolean(),
        }),
      ),
      nextToken: z.string().min(1).optional(),
    })
    .parse(wire)
  return record(
    identity,
    toolName,
    assetHoldersDataSchema.parse({
      balances: page.balances.map((holder) => ({
        address: holder.address,
        amount: String(holder.amount),
        isFrozen: holder.isFrozen,
      })),
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
  const page = z
    .object({
      applications: z.array(
        z.object({
          applicationId: z.union([z.number(), z.string()]),
          creator: z.string().min(1).optional(),
          globalState: z.array(z.unknown()).optional(),
        }),
      ),
      nextToken: z.string().min(1).optional(),
    })
    .parse(wire)
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

const stateEntryWireSchema = z.object({
  key: z.string().min(1),
  value: z.union([
    z.string(),
    z.number(),
    z.object({
      type: z.number(),
      bytes: z.string().optional(),
      uint: z.union([z.number(), z.string()]).optional(),
    }),
  ]),
  type: z.enum(['uint', 'bytes']).optional(),
  keyBase64: z.string().optional(),
})

function stateEntry(entry: z.infer<typeof stateEntryWireSchema>) {
  if (typeof entry.value === 'object' && entry.value !== null && 'type' in entry.value) {
    const typed = entry.value
    if (typed.type === 2 || typed.uint !== undefined) {
      return { key: entry.key, value: String(typed.uint ?? 0), type: 'uint' as const }
    }
    return { key: entry.key, value: typed.bytes ?? '', type: 'bytes' as const }
  }
  const type = entry.type ?? (typeof entry.value === 'number' ? 'uint' : 'bytes')
  return { key: entry.key, value: String(entry.value), type }
}

/** Wraps read_global_state and read_local_state (the unified scope shape). */
export function buildApplicationStateRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'read_global_state',
): StructuredResult {
  const single = z
    .object({
      appId: z.union([z.number(), z.string()]),
      scope: z.enum(['global', 'local']),
      address: z.string().min(1).optional(),
      optedIn: z.boolean().optional(),
      state: z.array(stateEntryWireSchema),
    })
    .parse(wire)
  return record(
    identity,
    toolName,
    applicationStateDataSchema.parse({
      applicationId: single.appId,
      scope: single.scope,
      ...(single.address === undefined ? {} : { address: single.address }),
      ...(single.optedIn === undefined ? {} : { optedIn: single.optedIn }),
      entries: single.state.map(stateEntry),
    }),
  )
}

/** Wraps get_account_app_local_states. */
export function buildApplicationLocalsRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'get_account_app_local_states',
): StructuredResult {
  const page = z
    .object({
      appLocalStates: z.array(
        z.object({
          applicationId: z.union([z.number(), z.string()]),
          schema: z
            .object({
              numByteSlice: z.number().int().nonnegative(),
              numUint: z.number().int().nonnegative(),
            })
            .optional(),
          keyValue: z.array(stateEntryWireSchema).optional(),
        }),
      ),
      nextToken: z.string().min(1).optional(),
      address: z.string().min(1).optional(),
    })
    .parse(wire)
  return record(
    identity,
    toolName,
    applicationLocalsDataSchema.parse({
      ...(page.address === undefined ? {} : { address: page.address }),
      apps: page.appLocalStates.map((app) => ({
        applicationId: app.applicationId,
        ...(app.schema === undefined ? {} : { schema: app.schema }),
        entries: (app.keyValue ?? []).map(stateEntry),
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
  const page = z
    .object({
      applicationId: z.union([z.number(), z.string()]),
      logData: z.array(
        z.object({
          txid: z.string().min(1),
          logs: z.array(z.string()),
        }),
      ),
      nextToken: z.string().min(1).optional(),
    })
    .parse(wire)
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
  const box = z
    .object({
      appId: z.union([z.number(), z.string()]),
      boxName: z.string().min(1),
      exists: z.boolean(),
      value: z.string().optional(),
      size: z.number().int().nonnegative().optional(),
    })
    .parse(wire)
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
  const page = z
    .object({
      blocks: z.array(
        z.object({
          round: z.number().int().nonnegative(),
          timestamp: z.number().int().nonnegative(),
          transactionCount: z.number().int().nonnegative(),
          proposer: z.string().min(1).optional(),
        }),
      ),
      nextToken: z.string().min(1).optional(),
    })
    .parse(wire)
  return record(
    identity,
    toolName,
    blockListDataSchema.parse({
      blocks: page.blocks,
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}
