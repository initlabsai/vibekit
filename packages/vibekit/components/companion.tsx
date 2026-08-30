'use client'

/**
 * Companion: a one-line face that never picks its own mood. You pass `mood`
 * and `faces`; it renders `faces[mood][step % length]`, so bumping `step` on
 * each event steps through the set (a dance, a spinner) and a constant step
 * holds one face. Optional `blink` swaps in an idle face now and then while
 * `mood === blinkOn`. Copy this file and companion.css; edit freely.
 */
import { useEffect, useState } from 'react'

export type Faces = Record<string, readonly string[]>

export function faceFor(faces: Faces, mood: string, step: number): string {
  const set = faces[mood] ?? Object.values(faces)[0] ?? ['']
  return set[Math.abs(step) % set.length]!
}

export type CompanionProps = {
  mood: string
  step: number
  faces: Faces
  /** Idle face; omit to never blink. */
  blink?: string
  /** Which mood blinks. Default: 'calm'. */
  blinkOn?: string
  /** Frozen: default face, no blink, no glitch, dimmed. */
  still?: boolean
  className?: string
}

export function Companion({ mood, step, faces, blink, blinkOn = 'calm', still = false, className = '' }: CompanionProps) {
  const [blinking, setBlinking] = useState(false)
  const canBlink = blink !== undefined && mood === blinkOn && !still
  useEffect(() => {
    if (!canBlink) return
    let timeout: ReturnType<typeof setTimeout> | undefined
    const interval = setInterval(() => {
      setBlinking(true)
      timeout = setTimeout(() => setBlinking(false), 140)
    }, 3800 + Math.floor(Math.random() * 2600))
    return () => {
      clearInterval(interval)
      if (timeout) clearTimeout(timeout)
    }
  }, [canBlink])
  if (still) {
    return (
      <span className={`companion companion-still ${className}`} aria-hidden="true">
        {faceFor(faces, blinkOn, 0)}
      </span>
    )
  }
  const face = canBlink && blinking ? blink : faceFor(faces, mood, step)
  return (
    <span className={`companion companion-${mood} glitch ${className}`} data-text={face} aria-hidden="true">
      {face}
    </span>
  )
}
