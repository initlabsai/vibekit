type IndexerAsset = InstanceType<typeof import('algosdk').indexerModels.Asset>

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

export function formatAsset(asset: IndexerAsset): FormattedAsset {
  const params = asset.params
  return {
    assetId: Number(asset.index),
    name: params.name,
    unitName: params.unitName,
    totalSupply: String(params.total),
    decimals: params.decimals,
    creator: params.creator ? String(params.creator) : undefined,
    manager: params.manager ? String(params.manager) : undefined,
    reserve: params.reserve ? String(params.reserve) : undefined,
    freeze: params.freeze ? String(params.freeze) : undefined,
    clawback: params.clawback ? String(params.clawback) : undefined,
    defaultFrozen: params.defaultFrozen,
    url: params.url,
  }
}
