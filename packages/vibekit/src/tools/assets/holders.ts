import type { ToolContext } from '../../core/index.js'
import { approxWords, scaleBaseUnits } from './format.js'

// ponytail: exhaustive paging capped at 25k holders; stream/threshold approach if mega-assets matter
const PAGE_SIZE = 1000
const MAX_PAGES = 25

export interface TopHolder {
  address: string
  amount: string
  amountScaled: string
  amountApprox?: string
  percentOfSupply: number
  isFrozen: boolean
}

export interface TopAssetHolders {
  balances: TopHolder[]
  decimals?: number
  holderCount: number
  /** False when the holder set exceeded the paging cap; the list may miss holders. */
  complete: boolean
}

/**
 * True top holders: the indexer pages balances by address (never by size), so
 * the only correct answer is to fetch every page, sort, and slice.
 */
export async function topAssetHolders(
  ctx: ToolContext,
  args: { assetId: number; limit?: number; minBalance?: number; maxBalance?: number },
): Promise<TopAssetHolders> {
  const limit = Math.min(args.limit ?? 10, 100)

  let decimals: number | undefined
  let total: bigint | undefined
  try {
    const res = await ctx.indexer.lookupAssetByID(args.assetId).do()
    decimals = Number(res.asset.params.decimals ?? 0)
    total = BigInt(res.asset.params.total)
  } catch {
    /* percentages and scaling degrade gracefully */
  }

  const all: { address: string; amount: bigint; isFrozen: boolean }[] = []
  let nextToken: string | undefined
  let complete = true
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = ctx.indexer.lookupAssetBalances(args.assetId).limit(PAGE_SIZE)
    if (nextToken) query = query.nextToken(nextToken)
    if (args.minBalance !== undefined) query = query.currencyGreaterThan(args.minBalance)
    if (args.maxBalance !== undefined) query = query.currencyLessThan(args.maxBalance)
    const response = await query.do()
    for (const b of response.balances ?? []) {
      const amount = BigInt(b.amount)
      if (amount > 0n) all.push({ address: String(b.address), amount, isFrozen: b.isFrozen })
    }
    nextToken = response.nextToken
    if (!nextToken || (response.balances ?? []).length < PAGE_SIZE) break
    if (page === MAX_PAGES - 1) complete = false
  }

  all.sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0))

  const balances = all.slice(0, limit).map((h) => {
    const amountScaled =
      decimals === undefined ? h.amount.toString() : scaleBaseUnits(h.amount, decimals)
    return {
      address: h.address,
      amount: h.amount.toString(),
      amountScaled,
      amountApprox: approxWords(amountScaled),
      percentOfSupply: total ? Number((h.amount * 10000n) / total) / 100 : 0,
      isFrozen: h.isFrozen,
    }
  })

  return {
    balances,
    ...(decimals === undefined ? {} : { decimals }),
    holderCount: all.length,
    complete,
  }
}
