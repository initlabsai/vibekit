import { ToolError, type ToolContext } from '../../../core/index.js'
import algosdk from 'algosdk'
import { isNotFound } from '../../shared/errors.js'
import { uint64 } from '../../shared/format.js'
import { getAccountAssets } from './assets.js'
import type { AccountAsset } from './format.js'

/**
 * Core account portfolio: ALGO balance + all asset holdings.
 * Does NOT include USD enrichment — that's explorer-specific middleware.
 */
export async function getAccountPortfolio(
  ctx: ToolContext,
  args: { address: string },
): Promise<{
  address: string
  balanceMicroAlgos: number | string
  assets: AccountAsset[]
  totalAssets: number
}> {
  if (!algosdk.isValidAddress(args.address)) {
    throw new ToolError('INVALID_ADDRESS', `Invalid Algorand address: ${args.address}`)
  }
  let response
  try {
    response = await ctx.indexer.lookupAccountByID(args.address).exclude('all').do()
  } catch (error) {
    // The indexer 404s for an address with no on-chain history; to the
    // user that is an empty account, not an error.
    if (isNotFound(error)) return { address: args.address, balanceMicroAlgos: 0, assets: [], totalAssets: 0 }
    throw error
  }
  const balanceMicroAlgos = uint64(response.account?.amount ?? BigInt(0))

  // Paginate up to 200 assets
  const allAssets: AccountAsset[] = []
  let nextToken: string | undefined
  do {
    const page = await getAccountAssets(ctx, {
      address: args.address,
      limit: 100,
      nextToken,
    })
    allAssets.push(...page.assets)
    nextToken = page.nextToken
  } while (nextToken && allAssets.length < 200)

  return { address: args.address, balanceMicroAlgos, assets: allAssets, totalAssets: allAssets.length }
}
