'use client'

/**
 * The companion: a one-line kaomoji beside what the agent says, in the same
 * mono as the ids. Her mood is deterministic — from the feed, never from a
 * model — so she is honest about exactly as much as the cards are. Tool
 * calls make her dance a step each; the glitch is the website's.
 */
import { useEffect, useState } from 'react'

import type { Section } from '../../feed/hooks'

export type Mood = 'calm' | 'thinking' | 'working' | 'bright' | 'squint'

/** Several faces per mood; `seed` picks one so a row keeps its face. */
const FACES: Record<Mood, readonly string[]> = {
  calm: ['(^‿^)', '(・‿・)', '(´▽`)', '(◕‿◕)'],
  thinking: ['(・・?)', '(￣ω￣;)', '(˘︹˘ )', '(°ロ°)'],
  // Kirby's dance, one step per call.
  working: ["(>'-')>", "<('-'<)", "^('-')^", "v('-')v"],
  bright: ['\\(^▽^)/', '(★‿★)', '(⌒▽⌒)☆', '(っ^▿^)۶'],
  squint: ['(¬_¬)', '(>_<)', '(x_x)', '(－‸ლ)'],
}
const BLINK = '(-‿-)'

/** The mood a section's agent row calls for. */
export function moodFor(section: Section | undefined, item: { pending?: boolean; text: string }, streaming: boolean): Mood {
  if (item.pending) return item.text.startsWith('→') ? 'working' : 'thinking'
  if (streaming) return 'thinking'
  const last = section?.items.at(-1)
  if (last?.kind === 'note' && last.tone === 'error') return 'squint'
  if (last?.kind === 'block' && last.block.kind === 'write') {
    const stage = last.block.flow.stage
    if (stage === 'denied') return 'squint'
    if (stage === 'confirmed') return 'bright'
  }
  return 'calm'
}

export function faceFor(mood: Mood, seed: number): string {
  const faces = FACES[mood]
  return faces[Math.abs(seed) % faces.length]!
}

/** `still`: a past line — the default face, no blink, no glitch, dimmed. Only her latest line is alive. */
export function CompanionFace({ mood, seed, still = false }: { mood: Mood; seed: number; still?: boolean }) {
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    if (mood !== 'calm' || still) return
    let timeout: ReturnType<typeof setTimeout> | undefined
    const interval = setInterval(() => {
      setBlink(true)
      timeout = setTimeout(() => setBlink(false), 140)
    }, 3800 + Math.floor(Math.random() * 2600))
    return () => {
      clearInterval(interval)
      if (timeout) clearTimeout(timeout)
    }
  }, [mood, still])
  if (still) {
    const face = faceFor('calm', 0)
    return (
      <span className="companion companion-still" aria-hidden="true">
        {face}
      </span>
    )
  }
  const face = blink && mood === 'calm' ? BLINK : faceFor(mood, seed)
  return (
    <span className={`companion companion-${mood} glitch`} data-text={face} aria-hidden="true">
      {face}
    </span>
  )
}
