/** The active network: the remote host for it, the sample fallback, the reachability probe, and the round poll. */
import { createSampleHost, type LiveNetworkId } from '@initlabs/vibekit-explorer'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createRemoteExplorerHost, type RemoteExplorerHost } from '../../remote-host'

export const NETWORKS: LiveNetworkId[] = ['localnet', 'testnet', 'mainnet']

/** Where the Explorer starts: testnet, so a connected wallet is on a live chain; localnet is one chip away. */
export function defaultNetwork(): LiveNetworkId {
  const configured = process.env.NEXT_PUBLIC_EXPLORER_DEFAULT_NETWORK
  return configured === 'localnet' || configured === 'mainnet' ? configured : 'testnet'
}

export type ExplorerHost = RemoteExplorerHost | ReturnType<typeof createSampleHost>

const ROUND_POLL_MS = 5000

export function useNetwork(args: { signDraft?: RemoteExplorerHost['signDraft']; network?: LiveNetworkId } = {}) {
  const [network, setNetwork] = useState<LiveNetworkId>(args.network ?? defaultNetwork)
  const networkRef = useRef(network)
  networkRef.current = network
  const { signDraft } = args
  const remoteHost = useMemo(
    () => createRemoteExplorerHost({ network, ...(signDraft ? { signDraft } : {}) }),
    [network, signDraft],
  )
  const sampleHost = useMemo(() => createSampleHost(), [])
  const [live, setLive] = useState<'probing' | boolean>('probing')
  const [latestRound, setLatestRound] = useState<number | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    setLive('probing')
    setLatestRound(undefined)
    remoteHost.probe().then((reachable) => {
      if (!cancelled) setLive(reachable)
    })
    return () => {
      cancelled = true
    }
  }, [remoteHost])

  useEffect(() => {
    if (live !== true) return
    let cancelled = false
    const tick = () =>
      document.visibilityState === 'hidden'
        ? Promise.resolve()
        : remoteHost.statusRound().then(
        ({ lastRound }) => {
          if (!cancelled) setLatestRound(lastRound)
        },
        () => undefined,
      )
    void tick()
    const id = setInterval(tick, ROUND_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [live, remoteHost])

  const host = useCallback(
    (): ExplorerHost => (live === true ? remoteHost : sampleHost),
    [live, remoteHost, sampleHost],
  )

  return { network, setNetwork, networkRef, remoteHost, sampleHost, host, live, latestRound }
}

export type NetworkLane = ReturnType<typeof useNetwork>
