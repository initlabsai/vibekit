'use client'

/**
 * qt314's moods. Her mood is deterministic — from the feed, never from a
 * model — so she is honest about exactly as much as the cards are. Tool
 * calls make her dance a step each; the glitch is the website's.
 * The face itself is the generic `Companion` in components/companion.tsx.
 */
import { Companion, faceFor as pick } from '../../components/companion'
import type { Section } from '../../feed/hooks'

export type Mood = 'calm' | 'thinking' | 'working' | 'bright' | 'squint'

/** Several faces per mood; `step` picks one so a row keeps its face. */
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
export function moodFor(section: Section | undefined, item: { pending?: boolean; text: string; mood?: Mood }, streaming: boolean): Mood {
  if (item.mood) return item.mood
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

export function faceFor(mood: Mood, step: number): string {
  return pick(FACES, mood, step)
}

/** `still`: a past line — the default face, no blink, no glitch, dimmed. Only her latest line is alive. */
export function CompanionFace({ mood, step, still = false }: { mood: Mood; step: number; still?: boolean }) {
  return <Companion mood={mood} step={step} faces={FACES} blink={BLINK} still={still} />
}
