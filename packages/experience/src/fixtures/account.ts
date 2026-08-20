import { buildAccountPortfolioRecord, type AccountLookupHost } from '../live-account.js'
import {
  buildAccountListRecord,
  buildApplicationStateRecord,
  buildAssetListRecord,
  buildTransactionListRecord,
} from '../live-catalog.js'
import type { StructuredResult } from '../results.js'
import { FIXTURE_RECEIVER, FIXTURE_SENDER, FIXTURE_TRANSACTION_ID } from './transaction.js'

/**
 * Real get_account_portfolio outputs recorded from localnet on 2026-08-19,
 * after the field-run payments (the balances are their arithmetic).
 */
const RECORDED_PORTFOLIOS = [
  {
    address: FIXTURE_SENDER,
    algoBalance: 8.44,
    assets: [],
    totalAssets: 0,
  },
  {
    address: FIXTURE_RECEIVER,
    algoBalance: 1.551,
    assets: [],
    totalAssets: 0,
  },
] as const

/** The sample address book shown when no keystore daemon is reachable. */
export const FIXTURE_ADDRESS_BOOK: ReadonlyArray<{ address: string; name: string }> = [
  { address: FIXTURE_SENDER, name: 'Sample sender' },
  { address: FIXTURE_RECEIVER, name: 'Sample receiver' },
]

function recordedWire(address: string) {
  const recorded = RECORDED_PORTFOLIOS.find((portfolio) => portfolio.address === address)
  if (!recorded) {
    throw new Error('Only the two sample accounts are available while localnet is offline')
  }
  return recorded
}

/** Adds sample account lookup to a host, replaying the recorded portfolios. */
export function createFixtureAccountLookup(): AccountLookupHost {
  let counter = 0
  return {
    async lookupAccount(address: string): Promise<StructuredResult> {
      const recorded = recordedWire(address)
      counter += 1
      return buildAccountPortfolioRecord(
        {
          resultId: `result-fixture-account-${address.slice(0, 8)}-${counter}`,
          toolCallId: `tool-call-fixture-account-${address.slice(0, 8)}-${counter}`,
          network: 'localnet',
        },
        recorded,
      )
    },
    async lookupAccounts(addresses: readonly string[]): Promise<StructuredResult> {
      const accounts = addresses.map((address) => {
        const recorded = recordedWire(address)
        return { address: recorded.address, balanceAlgos: recorded.algoBalance }
      })
      counter += 1
      return buildAccountListRecord(
        {
          resultId: `result-fixture-accounts-${counter}`,
          toolCallId: `tool-call-fixture-accounts-${counter}`,
          network: 'localnet',
        },
        { accounts },
        'batch_lookup_accounts',
      )
    },
    async lookupAccountAssets(address: string): Promise<StructuredResult> {
      recordedWire(address)
      counter += 1
      return buildAssetListRecord(
        {
          resultId: `result-fixture-assets-${counter}`,
          toolCallId: `tool-call-fixture-assets-${counter}`,
          network: 'localnet',
        },
        { assets: [] },
        'get_account_assets',
      )
    },
    async lookupAccountAppStates(address: string): Promise<StructuredResult> {
      recordedWire(address)
      counter += 1
      return buildApplicationStateRecord(
        {
          resultId: `result-fixture-apps-${counter}`,
          toolCallId: `tool-call-fixture-apps-${counter}`,
          network: 'localnet',
        },
        { appLocalStates: [], address },
        'get_account_app_local_states',
      )
    },
    async lookupAccountTransactions(address: string): Promise<StructuredResult> {
      recordedWire(address)
      counter += 1
      const transactions =
        address === FIXTURE_SENDER
          ? [
              {
                id: FIXTURE_TRANSACTION_ID,
                type: 'pay',
                sender: FIXTURE_SENDER,
                receiver: FIXTURE_RECEIVER,
                fee: 0.001,
                paymentAmount: 0.1,
                confirmedRound: 8,
              },
            ]
          : []
      return buildTransactionListRecord(
        {
          resultId: `result-fixture-txns-${counter}`,
          toolCallId: `tool-call-fixture-txns-${counter}`,
          network: 'localnet',
        },
        { address, transactions },
        'search_account_transactions',
      )
    },
  }
}
