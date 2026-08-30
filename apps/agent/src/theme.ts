/**
 * The Init Labs palette as the web Explorer uses it, the same values as the
 * TUI's theme and the website's tokens: amber is structure and figures, teal
 * is alive and touchable, red is danger only. `app/styles.css` carries the
 * same values as custom properties; this object is for the rare inline case.
 */
export const COLORS = {
  background: '#0a0b0e',
  card: '#111318',
  cardLit: '#181c24',
  surface: '#1a1c22',
  borderSoft: '#2a2723',
  border: '#4a4236',
  brass: '#c4a06a',
  brassBright: '#ffb454',
  ink: '#0a0b0e',
  signalDim: '#2e5c5e',
  signal: '#6fd3d3',
  redDim: '#6b2f2f',
  red: '#e07c7c',
  text: '#e9e1d4',
  muted: '#8e8476',
  faint: '#605c56',
} as const

/** A caught value as one line for a note or status. */
export function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  // algosdk prefixes every HTTP failure with its transport story; the tail is the message.
  return text.replace(/^Network request error\. Received status \d+ \([^)]*\): /, '')
}

/** A record's URL is only ever a link or image source when it is http(s); anything else renders as text. */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}

export function shorten(value: string, width: number): string {
  if (value.length <= width) return value
  const left = Math.ceil((width - 1) / 2)
  const right = Math.floor((width - 1) / 2)
  return `${value.slice(0, left)}…${value.slice(-right)}`
}
