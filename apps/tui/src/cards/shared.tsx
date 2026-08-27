import algosdk from 'algosdk'

import { base64ToBytes } from '@initlabs/vibekit'
import { formatMicroAlgos } from '@initlabs/vibekit-explorer'

import { COLORS, shorten, wrapLines } from '../theme.js'
import { Button, Card, Fact, FooterNote, Frame, Header, innerWidth, Rule } from '../ui.js'

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

/** Fixed-width cell for one-line table rows; shortens, never wraps. */
export function pad(text: string, width: number, align: 'left' | 'right' = 'left'): string {
  const cut = shorten(text, width)
  return align === 'right' ? cut.padStart(width) : cut.padEnd(width)
}

export function pageNotes(total: number, shown: number, nextToken?: string): string[] {
  const notes: string[] = []
  if (total > shown) notes.push(`${total - shown} more`)
  if (nextToken) notes.push('more pages available')
  return notes
}

/**
 * The bottom of a list card: a more ▸ button with the running count when the
 * record can fetch its next page, else the plain notes (rows hidden, pages left).
 */
export function MoreFooter({
  shown,
  total,
  nextToken,
  onMore,
  loadingMore = false,
  width,
}: {
  shown: number
  total: number
  nextToken?: string
  onMore?: () => void
  loadingMore?: boolean
  width: number
}) {
  if (onMore && nextToken) {
    return (
      <box flexDirection="row" marginTop={1} height={1} gap={2}>
        <Button
          label={loadingMore ? 'loading…' : 'more ▸'}
          onPress={loadingMore ? () => {} : onMore}
        />
        <text fg={COLORS.faint}>{`${total} so far`}</text>
      </box>
    )
  }
  return (
    <>
      {pageNotes(total, shown, nextToken).map((note) => (
        <FooterNote key={note} text={note} width={width} />
      ))}
    </>
  )
}

const TABLE_MAX_ROWS = 10

/** One field of a table row, stringified for display; Fact shortens long tails. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (['string', 'number', 'boolean'].includes(typeof value)) return String(value)
  return JSON.stringify(value)
}

/**
 * Generic card for any tool declaring the coarse `table` view: top-level
 * scalars as facts, the result's array as fact-rows. No schema — this is
 * RawCard with manners, not a trusted view.
 */
export function TableCard({
  title,
  facts,
  rows,
  width,
}: {
  title: string
  facts: Array<[string, string]>
  rows: Array<Record<string, unknown>>
  width: number
}) {
  const body = innerWidth(width)
  const shown = rows.slice(0, TABLE_MAX_ROWS)
  return (
    <Frame width={width}>
      <Header
        kicker={title.toUpperCase().replaceAll('_', ' ')}
        pill={String(rows.length)}
        tone="idle"
      />
      {facts.map(([key, value]) => (
        <Fact key={key} label={key} value={value} width={body} />
      ))}
      <box flexDirection="column">
        {shown.map((row, index) => (
          <box key={index} flexDirection="column" marginTop={1}>
            {Object.entries(row).map(([key, value]) => (
              <Fact key={key} label={key} value={cell(value)} width={body} />
            ))}
            {index < shown.length - 1 ? <Rule width={body} /> : null}
          </box>
        ))}
        {rows.length > shown.length ? (
          <FooterNote
            text={`${rows.length - shown.length} more rows — the model sees them all`}
            width={body}
          />
        ) : null}
      </box>
    </Frame>
  )
}

export function RawCard({ title, text, width }: { title: string; text: string; width: number }) {
  // Wrap rather than shorten: the tail of an error message is the useful part.
  // Leading whitespace survives so pretty-printed JSON stays indented.
  const lines = text.split('\n').flatMap((line) => {
    const indent = /^\s*/.exec(line)![0]
    return wrapLines(
      line.slice(indent.length),
      Math.max(innerWidth(width) - indent.length, 20),
    ).map((wrapped) => indent + wrapped)
  })
  const shown = lines.slice(0, 14)
  if (lines.length > 14) shown.push(`… ${lines.length - 14} more lines`)
  return <Card title={title.toUpperCase()} badge="RAW" tone="idle" lines={shown} width={width} />
}
