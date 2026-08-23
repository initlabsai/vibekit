import algosdk from 'algosdk'

import { base64ToBytes } from '@initlabs/vibekit-core'
import { formatMicroAlgos } from '@initlabs/vibekit-explorer'

import { wrapLines } from '../theme.js'
import { Card, innerWidth } from '../ui.js'

/**
 * Chain bytes for display, the way Lora reads them without a spec: a 32-byte
 * value is an Algorand address (checksummed), printable bytes are text,
 * everything else stays base64. A bound ARC-56 spec still overrides with names.
 */
export function bytesDisplay(base64: string): string {
  try {
    const bytes = base64ToBytes(base64)
    if (bytes.length === 32) return algosdk.encodeAddress(bytes)
    const text = new TextDecoder().decode(bytes)
    return /^[^\p{C}]+$/u.test(text) ? text : base64
  } catch {
    return base64
  }
}

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
