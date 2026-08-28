/** The active network: the remote host for it, the sample fallback, the reachability probe, and the round poll. */
import { createSampleHost, type LiveNetworkId } from '@initlabs/vibekit-explorer'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createRemoteExplorerHost, type RemoteExplorerHost } from '../../remote-host'

export const NETWORKS: LiveNetworkId[] = ['localnet', 'testnet', 'mainnet']

/** Where the Explorer starts: mainnet; `NEXT_PUBLIC_EXPLORER_DEFAULT_NETWORK` picks testnet or localnet. */
export function defaultNetwork(): LiveNetworkId {
  const configured = process.env.NEXT_PUBLIC_EXPLORER_DEFAULT_NETWORK
  return configured === 'localnet' || configured === 'testnet' ? configured : 'mainnet'
}

export type ExplorerHost = RemoteExplorerHost | ReturnType<typeof createSampleHost>

/** The round chip alone is fine a little stale; a block tail wants every round. */
const ROUND_POLL_IDLE_MS = 12000
const ROUND_POLL_TAIL_MS = 4000

export function useNetwork(args: { signDraft?: RemoteExplorerHost['signDraft']; network?: LiveNetworkId; tailing?: boolean } = {}) {
  const [network, setNetwork] = useState<LiveNetworkId>(args.network ?? defaultNetwork)
  const networkRef = useRef(network)
  networkRef.current = network
  // The wallet's signer comes and goes; the host (and everything cached on it) stays.
  const signDraftRef = useRef(args.signDraft)
  signDraftRef.current = args.signDraft
  const remoteHost = useMemo(
    () =>
      createRemoteExplorerHost({
        network,
        signDraft: (draftRecord) => {
          const sign = signDraftRef.current
          if (!sign) throw new Error('connect a wallet to sign')
          return sign(draftRecord)
        },
      }),
    [network],
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
    const id = setInterval(tick, args.tailing ? ROUND_POLL_TAIL_MS : ROUND_POLL_IDLE_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [args.tailing, live, remoteHost])

  const host = useCallback(
    (): ExplorerHost => (live === true ? remoteHost : sampleHost),
    [live, remoteHost, sampleHost],
  )

  return { network, setNetwork, networkRef, remoteHost, sampleHost, host, live, latestRound }
}

export type NetworkLane = ReturnType<typeof useNetwork>
