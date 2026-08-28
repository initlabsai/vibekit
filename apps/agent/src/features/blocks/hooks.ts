/** The block tail: the recent rounds, then every new one as the round chip ticks. */
import { useEffect, useRef, useState } from 'react'

import type { ExplorerHost } from '../network/hooks'

export interface TailRow {
  round: number
  timestamp: number
  transactionCount: number
  proposer?: string
  transactionTypes?: ReadonlyArray<{ type: string; count: number }>
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
    const previous = newest.current
    const from = Math.max(previous + 1, latestRound - TAIL_CATCHUP + 1)
    const rounds = Array.from({ length: latestRound - from + 1 }, (_, i) => latestRound - i)
    newest.current = latestRound
    let cancelled = false
    // The indexer trails algod by a round or two; a round it does not have yet is retried next tick.
    void Promise.allSettled(
      rounds.map(async (round) => {
        const record = await hostRef.current().lookupBlock(round)
        if (record.state !== 'success') throw new Error(`round ${round} unavailable`)
        const { round: r, timestamp, transactionCount, proposer, transactionTypes } = record.data as unknown as TailRow
        return { round: r, timestamp, transactionCount, ...(proposer ? { proposer } : {}), ...(transactionTypes ? { transactionTypes } : {}) }
      }),
    ).then((settled) => {
      if (cancelled) return
      const fresh = settled.flatMap((entry) => (entry.status === 'fulfilled' ? [entry.value] : []))
      const missed = settled.filter((entry) => entry.status === 'rejected').length
      if (fresh.length > 0) {
        setRows((current) => {
          const seen = new Set(current.map((row) => row.round))
          return [...fresh.filter((row) => !seen.has(row.round)), ...current].sort((a, b) => b.round - a.round).slice(0, TAIL_KEEP)
        })
      }
      // Anything missed is asked for again from the oldest missed round.
      if (missed > 0) newest.current = Math.min(...settled.map((entry, i) => (entry.status === 'rejected' ? rounds[i]! - 1 : latestRound)))
    })
    return () => {
      cancelled = true
    }
  }, [latestRound, live])

  return { rows, error }
}
