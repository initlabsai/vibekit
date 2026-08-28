'use client'

/**
 * The companion: a phosphor face that reacts to what the Explorer is doing.
 * Deterministic — moods come from the store and the feed, never from a
 * model — so it is honest about exactly as much as the cards are.
 */
import { useEffect, useState } from 'react'

import type { Section } from '../../feed/hooks'

export type Mood = 'calm' | 'curious' | 'bright' | 'squint' | 'blink'

const FACES: Record<Mood, string[]> = {
  calm: ['  ╭──────╮  ', '  │ ◠  ◠ │  ', '  │   ‿  │  ', '  ╰──────╯  '],
  blink: ['  ╭──────╮  ', '  │ ─  ─ │  ', '  │   ‿  │  ', '  ╰──────╯  '],
  curious: ['  ╭──────╮  ', '  │ ◉  ◠ │  ', '  │   ˘  │  ', '  ╰──────╯  '],
  bright: ['  ╭──────╮  ', '  │ ✦  ✦ │  ', '  │  ‿‿  │  ', '  ╰──────╯  '],
  squint: ['  ╭──────╮  ', '  │ ¬  ¬ │  ', '  │   ︵ │  ', '  ╰──────╯  '],
}

const LINES: Record<Exclude<Mood, 'blink'>, string[]> = {
  calm: ['watching the chain.', 'paste something.', 'every card is a tool result.', 'i only say what the bytes say.'],
  curious: ['looking…', 'asking the node.', 'one moment.'],
  bright: ['new round.', 'confirmed.', 'that landed.'],
  squint: ['that would fail.', 'hm. check that.', 'suspicious, per pera.', 'no.'],
}

/** The newest note or card decides the tone; errors and failed simulations squint. */
export function moodFor(args: { sections: Section[]; busy: boolean; roundTick: boolean }): Exclude<Mood, 'blink'> {
  if (args.busy) return 'curious'
  const last = args.sections.at(-1)?.items.at(-1)
  if (last?.kind === 'note' && last.tone === 'error') return 'squint'
  if (last?.kind === 'block' && last.block.kind === 'write') {
    const stage = last.block.flow.stage
    if (stage === 'denied') return 'squint'
    if (stage === 'confirmed') return 'bright'
  }
  return args.roundTick ? 'bright' : 'calm'
}

export function Companion({ sections, busy, latestRound, danger }: { sections: Section[]; busy: boolean; latestRound: number | undefined; danger: boolean }) {
  const [roundTick, setRoundTick] = useState(false)
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    if (latestRound === undefined) return
    setRoundTick(true)
    const id = setTimeout(() => setRoundTick(false), 900)
    return () => clearTimeout(id)
  }, [latestRound])
  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true)
      setTimeout(() => setBlink(false), 140)
    }, 4200)
    return () => clearInterval(id)
  }, [])
  const mood = danger ? 'squint' : moodFor({ sections, busy, roundTick })
  const face = FACES[blink && mood === 'calm' ? 'blink' : mood]
  const lines = LINES[mood]
  // A stable pick per situation: the same section keeps the same line.
  const seed = (sections.at(-1)?.id ?? 0) + (latestRound ?? 0)
  const line = lines[seed % lines.length]!
  return (
    <div className={`companion companion-${mood}`}>
      <pre className="companion-face" aria-hidden="true">{face.join('\n')}</pre>
      <p className="companion-line">{line}</p>
    </div>
  )
}
