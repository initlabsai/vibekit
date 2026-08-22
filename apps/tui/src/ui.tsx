import { createTextAttributes, type MouseEvent } from '@opentui/core'
import type { ReactNode } from 'react'

import { copyableIdent, useCopyIdent } from './copy-selection.js'
import { COLORS, shorten } from './theme.js'

const IDENT_ATTR = createTextAttributes({ underline: true })

/** Horizontal padding inside a framed card (border + paddingX). */
export const FRAME_GUTTER = 6

/** Status color for pills and accents. */
export type Tone = 'ok' | 'warn' | 'bad' | 'idle'

const PILL: Record<Tone, { fg: string; bg: string }> = {
  ok: { fg: COLORS.ink, bg: COLORS.green },
  warn: { fg: COLORS.ink, bg: COLORS.brass },
  bad: { fg: COLORS.text, bg: COLORS.red },
  idle: { fg: COLORS.muted, bg: COLORS.panelRaised },
}

export function innerWidth(width: number): number {
  return Math.max(8, width - FRAME_GUTTER)
}

/** Framed surface used by every result card. */
export function Frame({
  width,
  accent,
  children,
}: {
  width: number
  accent?: string
  children: ReactNode
}) {
  return (
    <box
      width={width}
      flexDirection="column"
      border
      borderStyle="single"
      borderColor={accent ?? COLORS.border}
      paddingX={2}
      paddingY={1}
      backgroundColor={COLORS.card}
      marginTop={1}
    >
      {children}
    </box>
  )
}

/** Tiny raised label, used for transaction type and similar tags. */
export function Chip({ label }: { label: string }) {
  return (
    <text fg={COLORS.muted} bg={COLORS.panelRaised}>
      {` ${label} `}
    </text>
  )
}

/** Clickable chip: padded and filled so it reads, and hits, as a button. */
export function Button({
  label,
  onPress,
  active = false,
}: {
  label: string
  onPress: () => void
  active?: boolean
}) {
  return (
    <box
      paddingX={1}
      backgroundColor={active ? COLORS.brass : COLORS.signalDim}
      onMouseDown={(event: MouseEvent) => {
        event.stopPropagation()
        onPress()
      }}
    >
      <text fg={active ? COLORS.ink : COLORS.text}>{label}</text>
    </box>
  )
}

/** Status badge: confirmed, failed, awaiting, and so on. */
export function Pill({ label, tone = 'idle' }: { label: string; tone?: Tone }) {
  const colors = PILL[tone]
  return (
    <text fg={colors.fg} bg={colors.bg}>
      {` ${label} `}
    </text>
  )
}

/**
 * Card masthead: brass kicker, optional type chip, optional status pill.
 * Mirrors the v1 Explorer header (icon + title + pill) in terminal terms.
 */
export function Header({
  kicker,
  chip,
  pill,
  tone,
  action,
}: {
  kicker: string
  chip?: string
  pill?: string
  tone?: Tone
  /** Card-local control (sort, graph/table), drawn beside the pill. */
  action?: ReactNode
}) {
  return (
    <box flexDirection="row" justifyContent="space-between" height={1}>
      <box flexDirection="row">
        <text fg={COLORS.brassBright}>{kicker}</text>
        {chip ? <text fg={COLORS.panel}> </text> : null}
        {chip ? <Chip label={chip} /> : null}
      </box>
      <box flexDirection="row" gap={1}>
        {action}
        {pill ? <Pill label={pill} tone={tone} /> : null}
      </box>
    </box>
  )
}

/** Large primary figure — amount, TPS, round — with a muted unit. */
export function Hero({
  value,
  unit,
  copy,
}: {
  value: string
  unit?: string
  copy?: string
}) {
  return (
    <box flexDirection="row" height={1} marginTop={1}>
      {copy ? (
        <Ident value={copy} display={value} width={Math.max(8, value.length)} color={COLORS.brassBright} />
      ) : (
        <text fg={COLORS.brassBright}>{value}</text>
      )}
      {unit ? <text fg={COLORS.muted}>{`  ${unit}`}</text> : null}
    </box>
  )
}

/**
 * Truncated identifier that copies the full value on click.
 * Signal + underline marks it as copyable.
 */
export function Ident({
  value,
  display,
  width,
  color = COLORS.signal,
}: {
  value: string
  display?: string
  width: number
  color?: string
}) {
  const copy = useCopyIdent()
  const full = copyableIdent(value)
  if (!full) {
    return <text fg={COLORS.text} content={shorten(display ?? value, width)} />
  }
  return (
    <text
      fg={color}
      attributes={IDENT_ATTR}
      content={shorten(display ?? value, width)}
      onMouseDown={(event: MouseEvent) => {
        event.stopPropagation()
        copy(full)
      }}
    />
  )
}

/** Sender → receiver path. */
export function PartyPath({
  from,
  to,
  width,
}: {
  from: string
  to?: string
  width: number
}) {
  if (!to) {
    return (
      <box marginTop={1}>
        <Ident value={from} width={width} />
      </box>
    )
  }
  const each = Math.max(8, Math.floor((width - 3) / 2))
  return (
    <box flexDirection="row" height={1} marginTop={1}>
      <Ident value={from} width={each} />
      <text fg={COLORS.brass}> → </text>
      <Ident value={to} width={each} />
    </box>
  )
}

const LABEL_WIDTH = 10

/** Labeled fact row: muted key, value. Pass `copy` for a clickable identifier. */
export function Fact({
  label,
  value,
  width,
  valueColor = COLORS.text,
  copy,
}: {
  label: string
  value: string
  width: number
  valueColor?: string
  copy?: string
}) {
  const room = Math.max(8, width - LABEL_WIDTH)
  return (
    <box flexDirection="row" height={1}>
      <text fg={COLORS.faint} content={label.padEnd(LABEL_WIDTH)} />
      {copyableIdent(copy) ? (
        <Ident value={copy!} display={value} width={room} />
      ) : (
        <text fg={valueColor} content={shorten(value, room)} />
      )}
    </box>
  )
}

/** Hairline between a card's header/hero and its facts or list. */
export function Rule({ width }: { width: number }) {
  return <text fg={COLORS.borderSoft} content={'─'.repeat(Math.max(4, width))} />
}

/** Compact metric cells in a row (account/network stat strips). */
export function StatGrid({
  items,
  width,
}: {
  items: ReadonlyArray<{ label: string; value: string; copy?: string }>
  width: number
}) {
  if (items.length === 0) return null
  const columns =
    width >= 56 && items.length >= 3 ? Math.min(4, items.length) : Math.min(2, items.length)
  const cellW = Math.max(10, Math.floor(width / columns))
  const rows: Array<typeof items> = []
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns))
  }
  return (
    <box flexDirection="column" marginTop={1}>
      {rows.map((row, rowIndex) => (
        <box key={rowIndex} flexDirection="row">
          {row.map((item) => (
            <box
              key={item.label}
              width={cellW}
              flexDirection="column"
              backgroundColor={COLORS.panelRaised}
              paddingX={1}
            >
              <text fg={COLORS.faint} content={shorten(item.label, cellW - 2)} />
              {copyableIdent(item.copy) ? (
                <Ident value={item.copy!} display={item.value} width={cellW - 2} />
              ) : (
                <text fg={COLORS.text} content={shorten(item.value, cellW - 2)} />
              )}
            </box>
          ))}
        </box>
      ))}
    </box>
  )
}

export function FooterNote({ text, width }: { text: string; width: number }) {
  return <text fg={COLORS.faint} marginTop={1} content={shorten(text, width)} />
}

export function Unavailable({ title, width }: { title: string; width: number }) {
  return (
    <Frame width={width} accent={COLORS.red}>
      <Header kicker={title} pill="UNAVAILABLE" tone="bad" />
      <text fg={COLORS.muted} marginTop={1} content="The record could not be derived." />
    </Frame>
  )
}

/** Simple framed card for raw dumps and anything that is still a list of lines. */
export function Card({
  title,
  chip,
  badge,
  tone,
  lines,
  width,
  children,
}: {
  title: string
  chip?: string
  badge?: string
  tone?: Tone
  lines?: string[]
  width: number
  children?: ReactNode
}) {
  const body = innerWidth(width)
  return (
    <Frame width={width}>
      <Header kicker={title} chip={chip} pill={badge} tone={tone} />
      {children}
      {lines && lines.length > 0 ? (
        <text
          fg={COLORS.text}
          marginTop={1}
          content={lines.map((line) => shorten(line, body)).join('\n')}
        />
      ) : null}
    </Frame>
  )
}
