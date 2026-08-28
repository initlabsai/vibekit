'use client'

/**
 * What the plugins add to a card once it is on screen: NFD names for
 * addresses, Pera verification tiers and logos, Vestige USD prices. Requests
 * batch per tick and cache per network; a card subscribes to one key and
 * re-renders when its answer lands. Nothing here blocks a card from showing.
 */
import { z } from 'zod'
import type { LiveNetworkId } from '@initlabs/vibekit-explorer'
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'

import type { RemoteExplorerHost } from './remote-host'

export type Tier = 'trusted' | 'verified' | 'unverified' | 'suspicious'

export interface AssetMeta {
  tier?: Tier
  logoUrl?: string
  priceUsd?: number
  name?: string
  unitName?: string
  url?: string
  project?: { name?: string; url?: string; twitter?: string; discord?: string; telegram?: string; description?: string }
}

const namesSchema = z.object({
  results: z.array(z.object({ address: z.string(), name: z.string().nullable(), avatar: z.string().optional() })),
})

/** An address's NFD identity: null when it has none. */
export interface Profile {
  name: string
  /** https URL; NFD's `assetid:` avatars are skipped. */
  avatar?: string
}
const profileSchema = z.object({
  verificationTier: z.string(),
  logoUrl: z.string().url().optional(),
  priceUsd: z.string().optional(),
  name: z.string().optional(),
  unitName: z.string().optional(),
  url: z.string().optional(),
  project: z
    .object({
      name: z.string().optional(),
      url: z.string().optional(),
      description: z.string().optional(),
      twitter: z.string().optional(),
      discord: z.string().optional(),
      telegram: z.string().optional(),
    })
    .optional(),
})
const pricesSchema = z.object({
  prices: z.array(z.object({ assetId: z.number(), priceUsd: z.string(), confidence: z.number() })),
})

const TIERS: Tier[] = ['trusted', 'verified', 'unverified', 'suspicious']
const NAME_BATCH = 20
const PROFILE_CONCURRENCY = 2

/** ALGO's own row: no profile, priced as asset 0. */
export const ALGO_ID = 0

export interface Enrichment {
  profile(address: string): Profile | null | undefined
  /** Price only by default; `withProfile` also asks Pera for tier, logo, and project — one call per asset, so only for what is on screen. */
  asset(assetId: number, withProfile?: boolean): AssetMeta | null | undefined
  subscribe(listener: () => void): () => void
}

const NONE: Enrichment = { profile: () => undefined, asset: () => undefined, subscribe: () => () => undefined }

export function createEnrichment(host: RemoteExplorerHost, isLive: () => boolean): Enrichment {
  const network = host.network as LiveNetworkId
  const namesOn = () => isLive() && (network === 'mainnet' || network === 'testnet')
  const assetsOn = () => isLive() && network === 'mainnet'
  const names = new Map<string, Profile | null>()
  const assets = new Map<number, AssetMeta | null>()
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => listener())
  let nameQueue = new Set<string>()
  let assetQueue = new Set<number>()
  let profileQueue = new Set<number>()
  const profiled = new Set<number>()
  let scheduled = false

  const flush = () => {
    scheduled = false
    const addresses = [...nameQueue]
    const ids = [...assetQueue]
    const profiles = [...profileQueue]
    nameQueue = new Set()
    assetQueue = new Set()
    profileQueue = new Set()
    for (let i = 0; i < addresses.length; i += NAME_BATCH) {
      const chunk = addresses.slice(i, i + NAME_BATCH)
      host
        .pluginTool('batch_reverse_resolve_nfd', { addresses: chunk })
        .then((output) => {
          for (const row of namesSchema.parse(output).results) {
            const avatar = row.avatar?.startsWith('https://') ? row.avatar : undefined
            names.set(row.address, row.name ? { name: row.name, ...(avatar ? { avatar } : {}) } : null)
          }
        })
        .catch(() => chunk.forEach((address) => names.set(address, null)))
        .finally(notify)
    }
    if (ids.length > 0) {
      for (const id of ids) if (!assets.has(id)) assets.set(id, {})
      // Vestige prices at most 50 ids per call; every queued id gets its call.
      for (let i = 0; i < ids.length; i += 50) {
        host
          .pluginTool('get_asset_prices', { assetIds: ids.slice(i, i + 50) })
          .then((output) => {
            for (const row of pricesSchema.parse(output).prices) {
              if (row.confidence < 0.5) continue
              assets.set(row.assetId, { ...(assets.get(row.assetId) ?? {}), priceUsd: Number(row.priceUsd) })
            }
          })
          .catch(() => undefined)
          .finally(notify)
      }
    }
    if (profiles.length > 0) {
      let cursor = 0
      const worker = async () => {
        while (cursor < profiles.length) {
          const id = profiles[cursor++]!
          try {
            const profile = profileSchema.parse(await host.pluginTool('get_asset_profile', { assetId: id }))
            const tier = TIERS.find((candidate) => candidate === profile.verificationTier)
            assets.set(id, {
              ...(assets.get(id) ?? {}),
              ...(tier ? { tier } : {}),
              ...(profile.logoUrl ? { logoUrl: profile.logoUrl } : {}),
              ...(profile.priceUsd && assets.get(id)?.priceUsd === undefined ? { priceUsd: Number(profile.priceUsd) } : {}),
              ...(profile.name ? { name: profile.name } : {}),
              ...(profile.unitName ? { unitName: profile.unitName } : {}),
              ...(profile.url ? { url: profile.url } : {}),
              ...(profile.project ? { project: profile.project } : {}),
            })
          } catch {
            if (!assets.has(id)) assets.set(id, null)
          }
          notify()
        }
      }
      for (let i = 0; i < PROFILE_CONCURRENCY; i++) void worker()
    }
  }
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    setTimeout(flush, 0)
  }

  return {
    profile(address) {
      if (!namesOn()) return undefined
      if (names.has(address)) return names.get(address)
      if (!nameQueue.has(address)) {
        nameQueue.add(address)
        schedule()
      }
      return undefined
    },
    asset(assetId, withProfile = false) {
      if (!assetsOn()) return undefined
      if (withProfile && assetId !== ALGO_ID && !profiled.has(assetId)) {
        profiled.add(assetId)
        profileQueue.add(assetId)
        schedule()
      }
      if (assets.has(assetId)) return assets.get(assetId)
      if (!assetQueue.has(assetId)) {
        assetQueue.add(assetId)
        schedule()
      }
      return undefined
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const EnrichmentContext = createContext<Enrichment>(NONE)

export function EnrichmentProvider({ host, live, children }: { host: RemoteExplorerHost; live: boolean; children: ReactNode }) {
  const liveRef = useRef(live)
  liveRef.current = live
  // One cache per host (network); flipping between live and sample keeps what was learned.
  const value = useMemo(() => createEnrichment(host, () => liveRef.current), [host])
  return <EnrichmentContext.Provider value={value}>{children}</EnrichmentContext.Provider>
}

function useEnrichmentValue<T>(read: (enrichment: Enrichment) => T): T {
  const enrichment = useContext(EnrichmentContext)
  return useSyncExternalStore(
    enrichment.subscribe,
    () => read(enrichment),
    () => undefined as T,
  )
}

/** The NFD identity for an address: known, null when it has none, undefined while unknown or off. */
export function useProfile(address: string | undefined): Profile | null | undefined {
  return useEnrichmentValue((enrichment) => (address ? enrichment.profile(address) : undefined))
}

export function useName(address: string | undefined): string | null | undefined {
  const profile = useProfile(address)
  return profile === undefined ? undefined : profile === null ? null : profile.name
}

export function useAssetMeta(assetId: number | string | undefined, withProfile = false): AssetMeta | null | undefined {
  return useEnrichmentValue((enrichment) =>
    assetId === undefined ? undefined : enrichment.asset(Number(assetId), withProfile),
  )
}

/** True once the element has been scrolled into view; profiles are fetched only for rows a person can see. */
export function useOnScreen<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element || seen) return
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setSeen(true)
        observer.disconnect()
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [seen])
  return [ref, seen]
}

/** ALGO's USD price (Vestige asset 0), or undefined while unknown or off. */
export function useAlgoPrice(): number | undefined {
  const meta = useAssetMeta(ALGO_ID)
  return meta?.priceUsd
}

export function formatUsd(value: number): string {
  if (value >= 1) return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return `$${value.toLocaleString(undefined, { maximumSignificantDigits: 3 })}`
}
