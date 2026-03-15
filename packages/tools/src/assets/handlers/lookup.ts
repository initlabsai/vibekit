import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { FormattedAsset } from '../types'

type IndexerAsset = InstanceType<typeof import('algosdk').indexerModels.Asset>

function formatAsset(asset: IndexerAsset): FormattedAsset {
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

export async function lookupAsset(
  algorand: AlgorandClient,
  args: { assetId: number }
): Promise<FormattedAsset> {
  const response = await algorand.client.indexer.lookupAssetByID(args.assetId).do()
  return formatAsset(response.asset)
}
