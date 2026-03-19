import { Semaphore } from '@vibekit/core'
import { LRUCache } from './lru-cache'

const peraSem = new Semaphore(8)

const PERA_API = 'https://mainnet.api.perawallet.app/v1/public'
const cache = new LRUCache<number, PeraAssetInfo>(500)

export interface PeraAssetInfo {
  logo: string | null
  name: string | null
  verificationTier: 'verified' | 'trusted' | 'suspicious' | 'unverified'
  usdValue: number | null
}

export async function getPeraAssetInfo(assetId: number): Promise<PeraAssetInfo | null> {
  if (cache.has(assetId)) return cache.get(assetId)!
  try {
    const res = await fetch(`${PERA_API}/assets/${assetId}`)
    if (!res.ok) return null
    const data = await res.json()
    const info: PeraAssetInfo = {
      logo: data.logo ?? null,
      name: data.name ?? null,
      verificationTier: data.verification_tier ?? 'unverified',
      usdValue: data.usd_value ? parseFloat(data.usd_value) : null,
    }
    cache.set(assetId, info)
    return info
  } catch {
    return null
  }
}

export async function getPeraAssetInfoBatch(
  assetIds: number[]
): Promise<Map<number, PeraAssetInfo>> {
  const result = new Map<number, PeraAssetInfo>()
  const uncached: number[] = []
  for (const id of assetIds) {
    if (cache.has(id)) result.set(id, cache.get(id)!)
    else uncached.push(id)
  }
  if (uncached.length === 0) return result
  const settled = await Promise.allSettled(
    uncached.map(async (id) => {
      const info = await peraSem.run(() => getPeraAssetInfo(id))
      return { id, info }
    })
  )
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value.info) {
      result.set(r.value.id, r.value.info)
    }
  }
  return result
}
