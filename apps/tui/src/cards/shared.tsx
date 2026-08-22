import { wrapLines } from '../theme.js'
import { formatMicroAlgos } from '@initlabs/vibekit-experience'

import { Card, innerWidth } from '../ui.js'

export function algo(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined
  return `${formatMicroAlgos(value)} ALGO`
}

export function pageNotes(total: number, shown: number, nextToken?: string): string[] {
  const notes: string[] = []
  if (total > shown) notes.push(`${total - shown} more`)
  if (nextToken) notes.push('more pages available')
  return notes
}

export function RawCard({
  title,
  text,
  width,
}: {
  title: string
  text: string
  width: number
}) {
  // Wrap rather than shorten: the tail of an error message is the useful part.
  const lines = text.split('\n').flatMap((line) => wrapLines(line, innerWidth(width)))
  const shown = lines.slice(0, 14)
  if (lines.length > 14) shown.push(`… ${lines.length - 14} more lines`)
  return (
    <Card title={title.toUpperCase()} badge="RAW" tone="idle" lines={shown} width={width} />
  )
}
