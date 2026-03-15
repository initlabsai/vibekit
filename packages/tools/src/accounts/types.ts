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
