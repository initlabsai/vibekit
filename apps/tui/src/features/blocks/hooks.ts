/**
 * Owns the Blocks page tail: algod wait-for-block ticks become block cards
 * on that page only. Leaving the page (or pausing) aborts the wait so the
 * host stops spending algod/indexer budget.
 */
import { addResult, type ResultStore, type ViewSpec } from '@initlabs/vibekit/views'
import { runBlockTail, type LiveNetworkId } from '@initlabs/vibekit/live'
import { useCallback, useEffect, useState } from 'react'

import { errorMessage } from '../../theme.js'
import { viewFor } from '../../lookup.js'
import type { Screen } from '../../top-bar.js'
import type { ExplorerHost } from '../network/hooks.js'

const KEEP = 16

export function useBlockTail({
  live,
  host,
  network,
  screen,
  commitStore,
  storeRef,
}: {
  live: 'probing' | boolean
  host: () => ExplorerHost
  network: LiveNetworkId
  screen: Screen
  commitStore: (next: ResultStore) => void
  storeRef: { current: ResultStore }
}) {
  const [latestRound, setLatestRound] = useState<number | undefined>()
  const [paused, setPaused] = useState(false)
  const [views, setViews] = useState<ViewSpec[]>([])
  const [error, setError] = useState<string | undefined>()
  const onBlocks = screen === 'blocks'
  const running = live === true && onBlocks && !paused

  useEffect(() => {
    setViews([])
    setError(undefined)
    setLatestRound(undefined)
    setPaused(false)
  }, [network])

  useEffect(() => {
    if (!running) return
    const abort = new AbortController()
    const current = host()
    void current
      .statusRound()
      .then((status) => {
        if (!abort.signal.aborted) setLatestRound(status.lastRound)
      })
      .catch(() => {
        /* first tick fills the round */
      })
    void runBlockTail(
      {
        status: () => current.statusRound(),
        waitAfter: (round) => current.waitAfterBlock(round),
        fetchRound: (round) => current.readBlockTick(round),
      },
      {
        signal: abort.signal,
        onTick: (tick) => {
          const nextStore = addResult(storeRef.current, tick.block)
          commitStore(nextStore)
          setLatestRound(tick.round)
          setError(undefined)
          setViews((currentViews) =>
            [...currentViews, viewFor(tick.block, 'block.detail')].slice(-KEEP),
          )
        },
        onError: (caught) => {
          if (abort.signal.aborted) return
          setError(errorMessage(caught))
        },
      },
    )
    return () => abort.abort()
  }, [commitStore, host, running, storeRef])

  const togglePause = useCallback(() => {
    if (live !== true) return
    setPaused((current) => !current)
  }, [live])

  return {
    latestRound: running || onBlocks ? latestRound : undefined,
    paused,
    running,
    views,
    error,
    togglePause,
  }
}
