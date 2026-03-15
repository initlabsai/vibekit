import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { sanitizeBigInts } from '@vibekit/core'
import type { AccountAsset } from '../types'
import { getAccountAssets } from './assets'

/**
 * Core account portfolio: ALGO balance + all asset holdings.
 * Does NOT include USD enrichment — that's explorer-specific middleware.
 */
export async function getAccountPortfolio(
  algorand: AlgorandClient,
  args: { address: string }
): Promise<{ address: string; algoBalance: number; assets: AccountAsset[]; totalAssets: number }> {
  const indexer = algorand.client.indexer
  const accountRaw = await indexer.lookupAccountByID(args.address).do()
  const account = sanitizeBigInts(accountRaw)
  const algoBalance =
    Number((account as Record<string, Record<string, unknown>>).account?.amount ?? 0) / 1_000_000

  // Paginate up to 200 assets
  const allAssets: AccountAsset[] = []
  let nextToken: string | undefined
  do {
    const page = await getAccountAssets(algorand, {
      address: args.address,
      limit: 100,
      nextToken,
    })
    allAssets.push(...page.assets)
    nextToken = page.nextToken
  } while (nextToken && allAssets.length < 200)

  return { address: args.address, algoBalance, assets: allAssets, totalAssets: allAssets.length }
}
