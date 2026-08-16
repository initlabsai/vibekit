/** Shared account formatting for the accounts tool domain. */

const MICROALGOS_PER_ALGO = 1_000_000

type IndexerAccount = InstanceType<typeof import('algosdk').indexerModels.Account>

/** Formatted account returned by handlers. */
export interface FormattedAccount {
  address: string
  balanceAlgos: number
  totalAssetsOptedIn?: number
  totalAppsOptedIn?: number
  totalCreatedAssets?: number
  totalCreatedApps?: number
  status?: string
  /** Raw uint64; decimal string when above 2^53. */
  rewardBase?: number | string
  createdAtRound?: number
}

/** Account asset holding. */
export interface AccountAsset {
  assetId: number
  amount: string
  isFrozen: boolean
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
    balanceAlgos: Number(account.amount) / MICROALGOS_PER_ALGO,
    totalAssetsOptedIn: account.totalAssetsOptedIn,
    totalAppsOptedIn: account.totalAppsOptedIn,
    totalCreatedAssets: account.totalCreatedAssets,
    totalCreatedApps: account.totalCreatedApps,
    status: account.status,
    rewardBase:
      account.rewardBase != null
        ? account.rewardBase <= BigInt(Number.MAX_SAFE_INTEGER)
          ? Number(account.rewardBase)
          : account.rewardBase.toString()
        : undefined,
    createdAtRound: account.createdAtRound != null ? Number(account.createdAtRound) : undefined,
  }
}
