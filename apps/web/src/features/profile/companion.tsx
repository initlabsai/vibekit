'use client'

/**
 * The companion: a small phosphor face beside what the agent says. Its mood
 * is deterministic — from the feed and the store, never from a model — so it
 * is honest about exactly as much as the cards are.
 */
import { useEffect, useState } from 'react'

import type { Section } from '../../feed/hooks'

export type Mood = 'calm' | 'curious' | 'bright' | 'squint' | 'blink'

const FACES: Record<Mood, string[]> = {
  calm: ['╭────╮', '│◠  ◠│', '│  ‿ │', '╰────╯'],
  blink: ['╭────╮', '│─  ─│', '│  ‿ │', '╰────╯'],
  curious: ['╭────╮', '│◉  ◠│', '│  ˘ │', '╰────╯'],
  bright: ['╭────╮', '│✦  ✦│', '│ ‿‿ │', '╰────╯'],
  squint: ['╭────╮', '│¬  ¬│', '│  ︵│', '╰────╯'],
}

/** The mood the newest thing in a section calls for. */
export function moodFor(section: Section | undefined, streaming: boolean): Exclude<Mood, 'blink'> {
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

export function CompanionFace({ mood }: { mood: Exclude<Mood, 'blink'> }) {
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    if (mood !== 'calm') return
    const id = setInterval(() => {
      setBlink(true)
      setTimeout(() => setBlink(false), 140)
    }, 4200 + Math.floor(Math.random() * 1500))
    return () => clearInterval(id)
  }, [mood])
  const face = FACES[blink && mood === 'calm' ? 'blink' : mood]
  return (
    <pre className={`companion-face companion-${mood}`} aria-hidden="true">
      {face.join('\n')}
    </pre>
  )
}
