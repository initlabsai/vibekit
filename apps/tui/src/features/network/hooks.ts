import { createSampleHost } from '@initlabs/vibekit/views/sample'
import type { LiveNetworkId } from '@initlabs/vibekit/live'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createKeystorePaymentHost, type KeystorePaymentHost } from './keystore-host.js'

export const NETWORKS: LiveNetworkId[] = ['localnet', 'testnet', 'mainnet']

/** Either the live keystore host for the active network or the fixture host. */
export type ExplorerHost = KeystorePaymentHost | ReturnType<typeof createSampleHost>

export interface NetworkLane {
  network: LiveNetworkId
  setNetwork: (net: LiveNetworkId) => void
  networkRef: { current: LiveNetworkId }
  keystoreHost: KeystorePaymentHost
  host: () => ExplorerHost
  live: 'probing' | boolean
}

/**
 * Owns the active network: the per-network keystore host cache, the fixture
 * fallback host, and the reachability probe that decides between them.
 */
export function useNetwork(): NetworkLane {
  const hostCache = useRef(new Map<LiveNetworkId, KeystorePaymentHost>())
  const hostFor = useCallback((net: LiveNetworkId): KeystorePaymentHost => {
    let cached = hostCache.current.get(net)
    if (!cached) {
      cached = createKeystorePaymentHost(net)
      hostCache.current.set(net, cached)
    }
    return cached
  }, [])
  const [network, setNetwork] = useState<LiveNetworkId>('localnet')
  const networkRef = useRef<LiveNetworkId>(network)
  networkRef.current = network
  const keystoreHost = hostFor(network)
  const sampleHost = useMemo(() => createSampleHost(), [])
  const [live, setLive] = useState<'probing' | boolean>('probing')

  useEffect(() => {
    let cancelled = false
    setLive('probing')
    keystoreHost.probe().then((reachable) => {
      if (!cancelled) setLive(reachable)
    })
    return () => {
      cancelled = true
    }
  }, [keystoreHost])

  const host = useCallback(
    () => (live === true ? keystoreHost : sampleHost),
    [keystoreHost, live, sampleHost],
  )

  return { network, setNetwork, networkRef, keystoreHost, host, live }
}
