import { indexerSemaphore, type ToolContext } from '../../core/index.js'
import type { FormattedTransaction } from './schemas.js'

interface AssetParams {
  name?: string
  unitName?: string
  decimals?: number
}

// Unit name and decimals are immutable once an ASA exists, so a per-deployment
// cache never goes stale. ponytail: unbounded; bound it if a process ever sees
// tens of thousands of distinct assets.
const cache = new WeakMap<ToolContext['algod'], Map<number, AssetParams | null>>()

function collectAssetIds(transactions: readonly FormattedTransaction[], into: Set<number>): void {
  for (const tx of transactions) {
    // Zero is an acfg create — the asset does not exist to look up.
    if (tx.assetId !== undefined && tx.assetId !== 0) into.add(tx.assetId)
    if (tx.innerTxns) collectAssetIds(tx.innerTxns, into)
  }
}

function apply(
  transactions: FormattedTransaction[],
  params: Map<number, AssetParams | null>,
): void {
  for (const tx of transactions) {
    const found = tx.assetId === undefined ? undefined : params.get(tx.assetId)
    if (found) {
      if (found.name) tx.assetName = found.name
      if (found.unitName) tx.assetUnitName = found.unitName
      if (found.decimals !== undefined) tx.assetDecimals = found.decimals
    }
    if (tx.innerTxns) apply(tx.innerTxns, params)
  }
}

/**
 * Fills assetName / assetUnitName / assetDecimals on every asset transaction
 * in the list (inner txns included), one algod call per distinct asset.
 * Presentation enrichment only: a failed lookup leaves the row as it was.
 */
export async function enrichAssetParams(
  ctx: ToolContext,
  transactions: FormattedTransaction[],
): Promise<void> {
  const ids = new Set<number>()
  collectAssetIds(transactions, ids)
  if (ids.size === 0) return
  let known = cache.get(ctx.algod)
  if (!known) {
    known = new Map()
    cache.set(ctx.algod, known)
  }
  const knownMap = known
  await Promise.all(
    [...ids]
      .filter((id) => !knownMap.has(id))
      .map((id) =>
        indexerSemaphore.run(async () => {
          try {
            const asset = await ctx.algod.getAssetByID(BigInt(id)).do()
            const params = asset.params
            knownMap.set(id, {
              ...(params?.name ? { name: params.name } : {}),
              ...(params?.unitName ? { unitName: params.unitName } : {}),
              ...(params?.decimals != null ? { decimals: Number(params.decimals) } : {}),
            })
          } catch {
            knownMap.set(id, null)
          }
        }),
      ),
  )
  apply(transactions, knownMap)
}
