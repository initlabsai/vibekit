/** Shared account formatting for the accounts tool domain. */

import { uint64 } from '../shared/format.js'

type IndexerAccount = InstanceType<typeof import('algosdk').indexerModels.Account>

/** Formatted account returned by handlers. */
export interface FormattedAccount {
  address: string
  /** microALGOs; decimal string when the uint64 exceeds 2^53. */
  balanceMicroAlgos: number | string
  totalAssetsOptedIn?: number
  totalAppsOptedIn?: number
  totalCreatedAssets?: number
  totalCreatedApps?: number
  status?: string
  /** microALGOs; decimal string when the uint64 exceeds 2^53. */
  minBalanceMicroAlgos?: number | string
  rekeyedTo?: string
  /** Raw uint64; decimal string when above 2^53. */
  rewardBase?: number | string
  createdAtRound?: number
}

/** Account asset holding. */
export interface AccountAsset {
  assetId: number
  /** Raw base units as a decimal string; scale by `decimals` for display. */
  amount: string
  isFrozen: boolean
  /** Asset decimals; absent when the metadata lookup failed. */
  decimals?: number
  name?: string
  unitName?: string
}

/** Account application local state. */
export interface AccountAppLocalState {
  applicationId: number
  schema: { numByteSlice: number; numUint: number }
  keyValue: Array<{
    key: string
    value: {
      type: number
      bytes?: string
      /** uint64 app state; decimal string when above 2^53 (post-jsonSafe). */
      uint?: bigint
    }
  }>
}

export function formatAccount(account: IndexerAccount): FormattedAccount {
  return {
    address: String(account.address),
    balanceMicroAlgos: uint64(account.amount),
    totalAssetsOptedIn: account.totalAssetsOptedIn,
    totalAppsOptedIn: account.totalAppsOptedIn,
    totalCreatedAssets: account.totalCreatedAssets,
    totalCreatedApps: account.totalCreatedApps,
    status: account.status,
    minBalanceMicroAlgos: account.minBalance != null ? uint64(account.minBalance) : undefined,
    rekeyedTo: account.authAddr ? String(account.authAddr) : undefined,
    rewardBase: account.rewardBase != null ? uint64(account.rewardBase) : undefined,
    createdAtRound: account.createdAtRound != null ? Number(account.createdAtRound) : undefined,
  }
}
