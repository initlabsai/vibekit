import type { ToolContext } from '../../core/index.js'
import { formatAsset, type FormattedAsset } from './format.js'

export async function lookupAsset(
  ctx: ToolContext,
  args: { assetId: number },
): Promise<FormattedAsset> {
  const response = await ctx.indexer.lookupAssetByID(args.assetId).do()
  return formatAsset(response.asset)
}
