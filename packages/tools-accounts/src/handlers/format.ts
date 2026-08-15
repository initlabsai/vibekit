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
  rewardBase?: number
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
      uint?: number
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
    rewardBase: account.rewardBase != null ? Number(account.rewardBase) : undefined,
    createdAtRound: account.createdAtRound != null ? Number(account.createdAtRound) : undefined,
  }
}
