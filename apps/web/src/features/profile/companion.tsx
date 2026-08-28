'use client'

/**
 * The companion: a small neon face beside what the agent says. Dark body,
 * phosphor features, a teal/brass ghost offset behind it that glitches now
 * and then. Its mood is deterministic — from the feed, never from a model —
 * so it is honest about exactly as much as the cards are.
 */
import { useEffect, useState } from 'react'

import type { Section } from '../../feed/hooks'

export type Mood = 'calm' | 'curious' | 'bright' | 'squint'

/** The mood the newest thing in a section calls for. */
export function moodFor(section: Section | undefined, streaming: boolean): Mood {
  if (streaming) return 'curious'
  const last = section?.items.at(-1)
  if (last?.kind === 'note' && last.tone === 'error') return 'squint'
  if (last?.kind === 'block' && last.block.kind === 'write') {
    const stage = last.block.flow.stage
    if (stage === 'denied') return 'squint'
    if (stage === 'confirmed') return 'bright'
  }
  return 'calm'
}

/** Eyes and mouth per mood, on a 32×32 grid; strokes are round and neon. */
function Features({ mood, blink }: { mood: Mood; blink: boolean }) {
  const stroke = { fill: 'none', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (blink) {
    return (
      <>
        <path d="M9 14.5h5M18 14.5h5" {...stroke} />
        <path d="M13 21q3 2.2 6 0" {...stroke} />
      </>
    )
  }
  switch (mood) {
    case 'calm':
      return (
        <>
          <path d="M9 15q2.5-3.5 5 0M18 15q2.5-3.5 5 0" {...stroke} />
          <path d="M13 21q3 2.4 6 0" {...stroke} />
        </>
      )
    case 'curious':
      return (
        <>
          <circle cx="11.5" cy="14" r="3.1" />
          <circle cx="11.5" cy="14" r="1.1" fill="var(--ink)" />
          <path d="M18 15q2.5-3.5 5 0" {...stroke} />
          <circle cx="16" cy="21.5" r="1.8" />
        </>
      )
    case 'bright':
      return (
        <>
          <path d="M11.5 10.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1zM20.5 10.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
          <path d="M10.5 20q5.5 6 11 0" {...stroke} />
        </>
      )
    case 'squint':
      return (
        <>
          <path d="M8.5 12.5l6 2.5M23.5 12.5l-6 2.5" {...stroke} />
          <path d="M12 22.5q4-3 8 0" {...stroke} />
        </>
      )
  }
}

export function CompanionFace({ mood }: { mood: Mood }) {
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    if (mood !== 'calm') return
    let timeout: ReturnType<typeof setTimeout> | undefined
    const interval = setInterval(() => {
      setBlink(true)
      timeout = setTimeout(() => setBlink(false), 130)
    }, 3600 + Math.floor(Math.random() * 2400))
    return () => {
      clearInterval(interval)
      if (timeout) clearTimeout(timeout)
    }
  }, [mood])
  return (
    <span className={`companion companion-${mood}`} aria-hidden="true">
      <svg className="companion-svg" viewBox="0 0 32 32" width="24" height="24">
        {/* the ghosts: the same face split into teal and brass, offset, sliced by the glitch */}
        <g className="companion-ghost companion-ghost-a">
          <circle cx="16" cy="16" r="13" />
          <Features mood={mood} blink={blink} />
        </g>
        <g className="companion-ghost companion-ghost-b">
          <circle cx="16" cy="16" r="13" />
          <Features mood={mood} blink={blink} />
        </g>
        <g className="companion-body">
          <circle cx="16" cy="16" r="13" />
        </g>
        <g className="companion-features">
          <Features mood={mood} blink={blink} />
        </g>
      </svg>
    </span>
  )
}
