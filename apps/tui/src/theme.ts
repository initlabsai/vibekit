/**
 * Init Labs palette for the TUI Explorer, amber-phosphor edition: cold
 * near-black, antique brass for structure, hot amber for figures, and one
 * cold signal color reserved for live data you can act on (identifiers,
 * the round counter). Brass says "frame"; signal says "touch this".
 */
export const COLORS = {
  background: '#0a0b0e',
  panel: '#111318',
  panelRaised: '#181b22',
  brass: '#c4a06a',
  brassBright: '#ffb454',
  signal: '#6fd3d3',
  signalDim: '#2e5c5e',
  text: '#e9e1d4',
  muted: '#8e8476',
  faint: '#605c56',
  green: '#9aaa6e',
  red: '#e07c7c',
  border: '#4a4236',
  borderSoft: '#2a2723',
  ink: '#0a0b0e',
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
