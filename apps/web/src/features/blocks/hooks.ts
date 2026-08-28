/** The block tail: the recent rounds, then every new one as the round chip ticks. */
import { useEffect, useRef, useState } from 'react'

import type { ExplorerHost } from '../network/hooks'

export interface TailRow {
  round: number
  timestamp: number
  transactionCount: number
  proposer?: string
}

const TAIL_LENGTH = 20
const TAIL_KEEP = 60
/** A long gap (tab hidden) is caught up from the newest side; older rounds stay reachable by id. */
const TAIL_CATCHUP = 5

export function useBlockTail({
  host,
  live,
  latestRound,
}: {
  host: () => ExplorerHost
  live: 'probing' | boolean
  latestRound: number | undefined
}) {
  const [rows, setRows] = useState<TailRow[]>([])
  const [error, setError] = useState<string | undefined>(undefined)
  const newest = useRef<number | undefined>(undefined)
  const hostRef = useRef(host)
  hostRef.current = host

  // Seed once live: the last TAIL_LENGTH headers.
  useEffect(() => {
    if (live !== true) return
    let cancelled = false
    newest.current = undefined
    setRows([])
    ;(async () => {
      try {
        const { lastRound } = await hostRef.current().statusRound()
        const page = await hostRef.current().callTool('search_block_headers', {
          limit: TAIL_LENGTH,
          minRound: Math.max(0, lastRound - TAIL_LENGTH + 1),
        })
        if (cancelled || page.state !== 'success') return
        const seeded = [...(page.data as unknown as { blocks: TailRow[] }).blocks].sort((a, b) => b.round - a.round)
        newest.current = seeded[0]?.round
        setRows(seeded)
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [live])

  // Then follow the round chip.
  useEffect(() => {
    if (live !== true || latestRound === undefined || newest.current === undefined || latestRound <= newest.current) return
    const from = Math.max(newest.current + 1, latestRound - TAIL_CATCHUP + 1)
    const rounds = Array.from({ length: latestRound - from + 1 }, (_, i) => latestRound - i)
    newest.current = latestRound
    let cancelled = false
    void Promise.all(
      rounds.map(async (round) => {
        const record = await hostRef.current().lookupBlock(round)
        if (record.state !== 'success') throw new Error(`round ${round} unavailable`)
        const { round: r, timestamp, transactionCount, proposer } = record.data as unknown as TailRow
        return { round: r, timestamp, transactionCount, ...(proposer ? { proposer } : {}) }
      }),
    )
      .then((fresh) => {
        if (!cancelled) setRows((current) => [...fresh, ...current].slice(0, TAIL_KEEP))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [latestRound, live])

  return { rows, error }
}
