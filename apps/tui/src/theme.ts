/**
 * Init Labs palette for the TUI Explorer, amber-phosphor edition. Two hues
 * and a ground: amber is structure and figures (what the data says), teal
 * is alive and touchable (live round, identifiers, confirmed, selection).
 * Red is danger only — mainnet, and a group that would fail — so that when
 * it appears, you stop. One lifted surface; cards are frames on the ground.
 */
export const COLORS = {
  background: '#0a0b0e',
  /** The one lifted surface: masthead, composer, chips, stat cells, modals, the selected row. */
  surface: '#1a1c22',
  // Amber, dim → bright: rules and frames, kickers, hero figures.
  borderSoft: '#2a2723',
  border: '#4a4236',
  brass: '#c4a06a',
  brassBright: '#ffb454',
  /** Text on an amber or teal fill. */
  ink: '#0a0b0e',
  // Teal: alive and touchable.
  signalDim: '#2e5c5e',
  signal: '#6fd3d3',
  // Danger only.
  redDim: '#6b2f2f',
  red: '#e07c7c',
  // Warm neutrals for prose and labels.
  text: '#e9e1d4',
  muted: '#8e8476',
  faint: '#605c56',
}

/** Motion is on unless the terminal (or its owner) says otherwise. */
export const MOTION = process.env.VIBEKIT_MOTION !== 'off'

function hex(color: string): [number, number, number] {
  const n = Number.parseInt(color.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Linear blend of two hex colors; t in [0, 1]. */
export function lerpColor(from: string, to: string, t: number): string {
  const a = hex(from)
  const b = hex(to)
  const mix = a.map((channel, i) => Math.round(channel + (b[i]! - channel) * t))
  return `#${mix.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

/** `steps` colors from `from` to `to`, inclusive. */
export function gradient(from: string, to: string, steps: number): string[] {
  return Array.from({ length: steps }, (_, i) => lerpColor(from, to, steps === 1 ? 0 : i / (steps - 1)))
}

/** A slow breath between two colors: up, then back down, in `steps` frames. */
export function breath(from: string, to: string, steps: number): string[] {
  const up = gradient(from, to, steps)
  return [...up, ...up.slice(1, -1).reverse()]
}

/** A caught value as one line for a note or status. */
export function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  // algosdk prefixes every HTTP failure with its transport story; the tail is the message.
  return text.replace(/^Network request error\. Received status \d+ \([^)]*\): /, '')
}

export function shorten(value: string, width: number): string {
  if (value.length <= width) return value
  const left = Math.ceil((width - 1) / 2)
  const right = Math.floor((width - 1) / 2)
  return `${value.slice(0, left)}…${value.slice(-right)}`
}

export function wrapLines(text: string, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      if (word === '') continue
      if (line === '') line = word
      else if (line.length + 1 + word.length <= width) line += ` ${word}`
      else {
        lines.push(line)
        line = word
      }
    }
    lines.push(line)
  }
  return lines
}
