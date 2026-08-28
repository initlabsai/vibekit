'use client'

/**
 * The transaction-group flow graph, drawn: one lifeline per entity, one row
 * per transaction, exactly as the shared TransactionsGraph model emits them.
 * A node marks the origin, an arrowhead the target, the caption sits on the
 * line; (n) and (rk) tags name which identity acted. Narrow viewports get
 * the same rows as a list.
 */
import {
  formatBaseUnits,
  formatMicroAlgos,
  type GraphHorizontal,
  type GraphLabel,
  type GraphMarkerTag,
  type GraphVertical,
  type TransactionsGraph,
} from '@initlabs/vibekit-explorer'
import { useContext, useEffect, useRef, useState } from 'react'

import { CopyContext } from '../../primitives'
import { COLORS, shorten } from '../../theme'

const ROW = 40
const HEAD = 34
const PAD_X = 24
const MIN_LANE = 150
const MAX_LANE = 280
/** Below this width the lanes are unreadable; rows become a list. */
const LANES_MIN_WIDTH = 600

/** Color family for a row label, from the palette only. */
function labelColor(type: string): string {
  if (type.startsWith('payment') || type === 'rekey') return COLORS.brass
  if (type === 'clawback' || type.startsWith('app')) return COLORS.brassBright
  if (type.startsWith('asset')) return COLORS.signal
  return COLORS.text
}

/** Row caption: a kind word where the amount alone would not say it, then the amount. */
function labelText(label: GraphLabel, isRemainder: boolean): string {
  const parts: string[] = []
  const remainder = isRemainder || label.type.endsWith('Remainder')
  if (remainder) parts.push('remainder')
  else if (label.type === 'assetOptIn') parts.push('opt-in')
  else if (label.type === 'rekey') return 'rekey'
  else if (label.type !== 'payment' && label.type !== 'assetTransfer')
    parts.push(`${label.type}${label.methodName ? ` ${label.methodName}` : ''}`)
  if (label.amountMicroAlgos !== undefined) parts.push(`${formatMicroAlgos(label.amountMicroAlgos)} ALGO`)
  else if (label.assetAmount !== undefined) {
    const value = label.assetDecimals === undefined ? String(label.assetAmount) : formatBaseUnits(label.assetAmount, label.assetDecimals)
    const unit = label.assetUnitName ?? (label.assetId === undefined ? '' : `asa ${label.assetId}`)
    parts.push(label.type === 'assetOptIn' ? unit : `${value} ${unit}`.trim())
  }
  return parts.join(' ') || label.type
}

function marker(tag: GraphMarkerTag | undefined): string {
  return tag === undefined ? '' : tag === 'rekey' ? '(rk)' : `(${tag})`
}

/** An end tag that repeats its own column's account number says nothing. */
function endTag(vertical: GraphVertical, tag: GraphMarkerTag | undefined): string {
  if (tag === undefined) return ''
  if (vertical.type === 'account' && tag === vertical.accountNumber) return ''
  if (vertical.type === 'application' && vertical.linkedAccount?.accountNumber === tag) return ''
  return marker(tag)
}

function heading(vertical: GraphVertical): { badge?: string; text: string; copy?: string; muted?: boolean } {
  switch (vertical.type) {
    case 'account':
      return { badge: `(${vertical.accountNumber})`, text: shorten(vertical.address, 11), copy: vertical.address }
    case 'application':
      return {
        text: `app ${vertical.applicationId}`,
        copy: String(vertical.applicationId),
        ...(vertical.linkedAccount ? { badge: `(${vertical.linkedAccount.accountNumber})` } : {}),
      }
    case 'asset':
      return { text: `asa ${vertical.assetId}`, copy: String(vertical.assetId) }
    case 'opUp':
      return { text: 'OpUp', muted: true }
  }
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setWidth(element.getBoundingClientRect().width)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

/** Approximate mono text width at the graph's font size, for laying captions on the line. */
const CHAR = 7.2

export function TransactionsGraphView({ graph }: { graph: TransactionsGraph }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const announce = useContext(CopyContext)
  const n = graph.verticals.length
  if (n === 0) return null
  if (width > 0 && width < LANES_MIN_WIDTH) return <GraphList graph={graph} />

  const lane = Math.max(MIN_LANE, Math.min(MAX_LANE, (width - PAD_X * 2) / Math.max(1, n - 0.5)))
  const centers = graph.verticals.map((_, i) => PAD_X + i * lane)
  const svgWidth = Math.max(width, centers[n - 1]! + lane * 0.6)
  const height = HEAD + graph.horizontals.length * ROW + 8
  const copy = (value: string) => {
    void navigator.clipboard?.writeText(value).then(() => announce(value))
  }

  return (
    <div ref={ref} className="graph">
      {width === 0 ? null : (
        <svg className="graph-svg" width={svgWidth} height={height} role="img" aria-label="transaction flow">
          {/* headings */}
          {graph.verticals.map((vertical, i) => {
            const h = heading(vertical)
            const x = centers[i]!
            return (
              <text key={`h${i}`} x={x} y={16} className="graph-heading">
                {h.badge ? <tspan fill={COLORS.brass}>{h.badge} </tspan> : null}
                <tspan
                  fill={h.muted ? COLORS.muted : COLORS.signal}
                  className={h.copy ? 'graph-copy' : undefined}
                  onClick={h.copy ? () => copy(h.copy!) : undefined}
                >
                  {h.text}
                </tspan>
              </text>
            )
          })}
          {/* lifelines */}
          {centers.map((x, i) => (
            <line key={`g${i}`} x1={x} x2={x} y1={HEAD - 8} y2={height - 4} stroke={COLORS.borderSoft} strokeDasharray="2 4" />
          ))}
          {graph.horizontals.map((row, r) => (
            <Row key={r} row={row} y={HEAD + r * ROW + ROW / 2} centers={centers} verticals={graph.verticals} lane={lane} onCopy={copy} />
          ))}
        </svg>
      )}
    </div>
  )
}

function Row({
  row,
  y,
  centers,
  verticals,
  lane,
  onCopy,
}: {
  row: GraphHorizontal
  y: number
  centers: number[]
  verticals: GraphVertical[]
  lane: number
  onCopy: (value: string) => void
}) {
  const rep = row.representation
  const color = row.isRemainder || row.label.type.endsWith('Remainder') ? COLORS.faint : labelColor(row.label.type)
  const caption = labelText(row.label, row.isRemainder)
  const captionW = caption.length * CHAR + 12
  const captionCopy = row.label.assetId === undefined ? undefined : String(row.label.assetId)
  const rowTitle = row.transactionId

  if (rep.kind === 'point') {
    const x = centers[rep.vertical]!
    return (
      <g className="graph-row" opacity={row.isRemainder ? 0.7 : 1}>
        <title>{rowTitle}</title>
        <circle cx={x} cy={y} r={4} fill={color} />
        <text x={x + 12} y={y + 4} fill={color} className="graph-caption">{caption} {marker(rep.fromTag)}</text>
      </g>
    )
  }
  if (rep.kind === 'selfLoop') {
    const x = centers[rep.vertical]!
    const w = Math.min(lane * 0.45, 56)
    const d = `M ${x} ${y - 9} h ${w} a 9 9 0 0 1 0 18 h ${-w + 8}`
    return (
      <g className="graph-row" opacity={row.isRemainder ? 0.7 : 1}>
        <title>{rowTitle}</title>
        <circle cx={x} cy={y - 9} r={3.5} fill={color} />
        <path d={d} fill="none" stroke={color} strokeWidth={1.25} />
        <Head x={x + 8} y={y + 9} dir="left" color={color} />
        <text x={x + w + 16} y={y + 4} fill={color} className="graph-caption">{caption} {marker(rep.fromTag)}{marker(rep.toTag)}</text>
      </g>
    )
  }
  const a = centers[rep.fromVertical]!
  const b = centers[rep.toVertical]!
  const leftToRight = rep.direction === 'leftToRight'
  const origin = leftToRight ? a : b
  const target = leftToRight ? b : a
  const leftTag = endTag(verticals[rep.fromVertical]!, leftToRight ? rep.fromTag : rep.toTag)
  const rightTag = endTag(verticals[rep.toVertical]!, leftToRight ? rep.toTag : rep.fromTag)
  const mid = (a + b) / 2
  const interior = b - a - 16 - (leftTag.length + rightTag.length) * CHAR
  const inline = captionW <= interior
  return (
    <g className="graph-row" opacity={row.isRemainder ? 0.7 : 1}>
      <title>{rowTitle}</title>
      <line x1={a} x2={b} y1={y} y2={y} stroke={color} strokeWidth={1.25} />
      <circle cx={origin} cy={y} r={3.5} fill={color} />
      <Head x={target} y={y} dir={leftToRight ? 'right' : 'left'} color={color} />
      {leftTag ? <text x={a + 8} y={y - 6} fill={COLORS.brass} className="graph-tag">{leftTag}</text> : null}
      {rightTag ? <text x={b - 8} y={y - 6} fill={COLORS.brass} className="graph-tag" textAnchor="end">{rightTag}</text> : null}
      {inline ? <rect x={mid - captionW / 2} y={y - 9} width={captionW} height={18} fill={COLORS.card} rx={2} /> : null}
      <text
        x={mid}
        y={inline ? y + 4 : y - 7}
        fill={color}
        textAnchor="middle"
        className={`graph-caption${captionCopy ? ' graph-copy' : ''}`}
        onClick={captionCopy ? () => onCopy(captionCopy) : undefined}
      >
        {caption}
      </text>
    </g>
  )
}

function Head({ x, y, dir, color }: { x: number; y: number; dir: 'left' | 'right'; color: string }) {
  const s = dir === 'right' ? 1 : -1
  return <path d={`M ${x} ${y} l ${-8 * s} -4.5 v 9 z`} fill={color} />
}

function GraphList({ graph }: { graph: TransactionsGraph }) {
  return (
    <ol className="graph-list">
      {graph.horizontals.map((row, index) => {
        const rep = row.representation
        const from = rep.kind === 'vector' ? (rep.direction === 'leftToRight' ? rep.fromVertical : rep.toVertical) : rep.vertical
        const to = rep.kind === 'vector' ? (rep.direction === 'leftToRight' ? rep.toVertical : rep.fromVertical) : rep.vertical
        const name = (i: number) => {
          const v = graph.verticals[i]
          return v ? heading(v).text : '?'
        }
        return (
          <li key={index} style={{ paddingLeft: `${row.depth}rem` }}>
            <span className="graph-label" style={{ color: labelColor(row.label.type) }}>{labelText(row.label, row.isRemainder)}</span>{' '}
            {name(from)}
            {rep.kind === 'selfLoop' ? ' ↺' : rep.kind === 'point' ? '' : ` → ${name(to)}`}
          </li>
        )
      })}
    </ol>
  )
}

