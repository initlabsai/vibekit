/** Formatted asset returned by handlers. */
export interface FormattedAsset {
  assetId: number
  name?: string
  unitName?: string
  totalSupply: string
  decimals: number
  creator?: string
  manager?: string
  reserve?: string
  freeze?: string
  clawback?: string
  defaultFrozen?: boolean
  url?: string
}

/** Asset balance entry. */
export interface AssetBalance {
  address: string
  amount: string
  isFrozen: boolean
}
