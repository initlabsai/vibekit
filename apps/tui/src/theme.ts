/**
 * Init Labs palette for the TUI Explorer. Warm black and antique brass,
 * matching initlabs.ai. The v1 Explorer's teal is not used.
 */
export const COLORS = {
  background: '#11100e',
  panel: '#191714',
  panelRaised: '#211d18',
  brass: '#c4a06a',
  brassBright: '#e0bd7b',
  text: '#e9e1d4',
  muted: '#8e8476',
  faint: '#6e6a62',
  green: '#9aaa6e',
  red: '#d88989',
  border: '#5f503c',
  borderSoft: '#3c3428',
  ink: '#1a160e',
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
