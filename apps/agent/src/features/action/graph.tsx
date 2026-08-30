'use client'

/**
 * The transaction-group flow graph, drawn: one lifeline per entity, one row
 * per transaction, exactly as the shared TransactionsGraph model emits them.
 * A node marks the origin, an arrowhead the target, the caption sits on the
 * line; (n) and (rk) tags name which identity acted. Narrow viewports scroll
 * the lanes sideways.
 */
import { formatBaseUnits, formatMicroAlgos, type GraphHorizontal, type GraphLabel, type GraphVertical, type TransactionsGraph } from '@initlabs/vibekit/views'
import { useContext, useEffect, useRef, useState } from 'react'

import { OpenContext } from '../../primitives'
import type { OpenTarget } from '../../result-card'
import { COLORS, shorten } from '../../theme'
import { TOP, layoutGraph, marker, type RowGeometry } from './graph-layout'

/** The lanes never draw narrower than this; a phone scrolls the card sideways instead. */
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

function heading(vertical: GraphVertical): { badge?: string; text: string; open?: OpenTarget; muted?: boolean } {
  switch (vertical.type) {
    case 'account':
      return { badge: `(${vertical.accountNumber})`, text: shorten(vertical.address, 11), open: { kind: 'account', address: vertical.address } }
    case 'application':
      return {
        text: `app ${vertical.applicationId}`,
        open: { kind: 'application', applicationId: Number(vertical.applicationId) },
        ...(vertical.linkedAccount ? { badge: `(${vertical.linkedAccount.accountNumber})` } : {}),
      }
    case 'asset':
      return { text: `asa ${vertical.assetId}`, open: { kind: 'asset', assetId: Number(vertical.assetId) } }
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

export function TransactionsGraphView({ graph }: { graph: TransactionsGraph }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const openTarget = useContext(OpenContext)
  const n = graph.verticals.length
  if (n === 0) return null
  const geometry = layoutGraph(graph, Math.max(width, LANES_MIN_WIDTH), (row) => labelText(row.label, row.isRemainder))
  const open = (target: OpenTarget) => openTarget?.(target)

  return (
    <div ref={ref} className="graph">
      {width === 0 ? null : (
        <svg className="graph-svg" width={geometry.width} height={geometry.height} role="img" aria-label="transaction flow">
          {graph.verticals.map((vertical, i) => {
            const h = heading(vertical)
            const x = geometry.centers[i]!
            return (
              <text key={`h${i}`} x={x} y={16} className="graph-heading">
                {h.badge ? <tspan fill={COLORS.brass}>{h.badge} </tspan> : null}
                <tspan
                  fill={h.muted ? COLORS.muted : COLORS.signal}
                  className={h.open && openTarget ? 'graph-open' : undefined}
                  onClick={h.open ? () => open(h.open!) : undefined}
                >
                  {h.text}
                </tspan>
              </text>
            )
          })}
          {geometry.centers.map((x, i) => (
            <line key={`g${i}`} x1={x} x2={x} y1={TOP - 8} y2={geometry.height - 4} stroke={COLORS.borderSoft} strokeDasharray="2 4" />
          ))}
          {graph.horizontals.map((row, r) => (
            <Row key={r} row={row} geometry={geometry.rows[r]!} onOpen={openTarget ? open : undefined} />
          ))}
        </svg>
      )}
    </div>
  )
}

function Row({ row, geometry, onOpen }: { row: GraphHorizontal; geometry: RowGeometry; onOpen?: (target: OpenTarget) => void }) {
  const color = row.isRemainder || row.label.type.endsWith('Remainder') ? COLORS.faint : labelColor(row.label.type)
  const caption = labelText(row.label, row.isRemainder)
  const captionOpen: OpenTarget | undefined = row.label.assetId === undefined || !onOpen ? undefined : { kind: 'asset', assetId: Number(row.label.assetId) }
  const opacity = row.isRemainder ? 0.7 : 1
  const g = geometry
  if (g.kind === 'point') {
    return (
      <g className="graph-row" opacity={opacity}>
        <title>{row.transactionId}</title>
        <circle cx={g.x} cy={g.y} r={4} fill={color} />
        <text x={g.captionX} y={g.y + 4} fill={color} className="graph-caption">{caption} {g.tags}</text>
      </g>
    )
  }
  if (g.kind === 'selfLoop') {
    const d = `M ${g.x} ${g.y - 9} h ${g.loopWidth} a 9 9 0 0 1 0 18 h ${-g.loopWidth + 8}`
    return (
      <g className="graph-row" opacity={opacity}>
        <title>{row.transactionId}</title>
        <circle cx={g.x} cy={g.y - 9} r={3.5} fill={color} />
        <path d={d} fill="none" stroke={color} strokeWidth={1.25} />
        <ArrowHead x={g.x + 8} y={g.y + 9} dir="left" color={color} />
        <text x={g.captionX} y={g.y + 4} fill={color} className="graph-caption">{caption} {g.tags}</text>
      </g>
    )
  }
  const captionW = caption.length * 7.2 + 12
  return (
    <g className="graph-row" opacity={opacity}>
      <title>{row.transactionId}</title>
      <line x1={g.a} x2={g.b} y1={g.y} y2={g.y} stroke={color} strokeWidth={1.25} />
      <circle cx={g.origin} cy={g.y} r={3.5} fill={color} />
      <ArrowHead x={g.target} y={g.y} dir={g.dir} color={color} />
      {g.leftTag ? <text x={g.a + 8} y={g.y - 6} fill={COLORS.brass} className="graph-tag">{g.leftTag}</text> : null}
      {g.rightTag ? <text x={g.b - 8} y={g.y - 6} fill={COLORS.brass} className="graph-tag" textAnchor="end">{g.rightTag}</text> : null}
      {g.captionInline ? <rect x={g.captionX - captionW / 2} y={g.y - 9} width={captionW} height={18} fill={COLORS.card} rx={2} /> : null}
      <text
        x={g.captionX}
        y={g.captionInline ? g.y + 4 : g.y - 7}
        fill={color}
        textAnchor="middle"
        className={`graph-caption${captionOpen ? ' graph-open' : ''}`}
        onClick={captionOpen ? () => onOpen!(captionOpen) : undefined}
      >
        {caption}
      </text>
    </g>
  )
}

function ArrowHead({ x, y, dir, color }: { x: number; y: number; dir: 'left' | 'right'; color: string }) {
  const s = dir === 'right' ? 1 : -1
  return <path d={`M ${x} ${y} l ${-8 * s} -4.5 v 9 z`} fill={color} />
}
