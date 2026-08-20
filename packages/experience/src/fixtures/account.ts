import { buildAccountPortfolioRecord, type AccountLookupHost } from '../live-account.js'
import type { StructuredResult } from '../results.js'
import { FIXTURE_RECEIVER, FIXTURE_SENDER } from './transaction.js'

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

/** Adds sample account lookup to a host, replaying the recorded portfolios. */
export function createFixtureAccountLookup(): AccountLookupHost {
  let counter = 0
  return {
    async lookupAccount(address: string): Promise<StructuredResult> {
      const recorded = RECORDED_PORTFOLIOS.find((portfolio) => portfolio.address === address)
      if (!recorded) {
        throw new Error('Only the two sample accounts are available while localnet is offline')
      }
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
  }
}
