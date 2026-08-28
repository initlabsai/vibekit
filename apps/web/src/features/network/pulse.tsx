'use client'

/** The chain's heartbeat beside the round: one bar per recent round, height by how long it took. */
import { useEffect, useRef, useState } from 'react'

const BARS = 9

export function RoundPulse({ round }: { round: number }) {
  const last = useRef<{ round: number; at: number } | null>(null)
  const [intervals, setIntervals] = useState<number[]>([])
  const [hot, setHot] = useState(false)
  useEffect(() => {
    const now = Date.now()
    const previous = last.current
    last.current = { round, at: now }
    if (!previous || round <= previous.round) return
    // Rounds arrive in bursts between polls; spread the elapsed time over them.
    const each = (now - previous.at) / (round - previous.round)
    setIntervals((current) => [...current, each].slice(-BARS))
    setHot(true)
    const id = setTimeout(() => setHot(false), 350)
    return () => clearTimeout(id)
  }, [round])
  const max = Math.max(3500, ...intervals)
  return (
    <span className={`pulse${hot ? ' hot' : ''}`} aria-hidden="true">
      {Array.from({ length: BARS }, (_, i) => {
        const value = intervals[intervals.length - BARS + i]
        const height = value === undefined ? 25 : Math.max(20, Math.min(100, (value / max) * 100))
        return <i key={i} style={{ height: `${height}%` }} className={value === undefined ? 'empty' : undefined} />
      })}
    </span>
  )
}
