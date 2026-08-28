'use client'

/**
 * The transaction-group flow graph as a CSS grid: one column per entity, one
 * row per transaction, exactly as the shared TransactionsGraph model emits
 * them. Narrow viewports get the same rows as a list instead of lanes.
 */
import {
  formatAssetAmount,
  formatMicroAlgos,
  type GraphHorizontal,
  type GraphLabel,
  type GraphVertical,
  type TransactionsGraph,
} from '@initlabs/vibekit-explorer'
import { useEffect, useState } from 'react'

import { Copyable } from '../../primitives'
import { shorten } from '../../theme'

const LABEL_TEXT: Record<GraphLabel['type'], string> = {
  payment: 'pay',
  paymentRemainder: 'close remainder',
  rekey: 'rekey',
  assetTransfer: 'transfer',
  assetTransferRemainder: 'close remainder',
  assetOptIn: 'opt-in',
  clawback: 'clawback',
  appCall: 'call',
  appCreate: 'create app',
  appUpdate: 'update app',
  assetCreate: 'create asset',
  assetReconfigure: 'reconfigure',
  assetDestroy: 'destroy',
  assetFreeze: 'freeze',
  keyReg: 'key reg',
  stateProof: 'state proof',
  heartbeat: 'heartbeat',
}

function labelText(label: GraphLabel): string {
  const kind = label.methodName ?? LABEL_TEXT[label.type]
  if (label.amountMicroAlgos !== undefined) return `${kind} ${formatMicroAlgos(label.amountMicroAlgos)} ALGO`
  if (label.assetAmount !== undefined)
    return `${kind} ${formatAssetAmount(label.assetAmount, label.assetDecimals, label.assetUnitName ?? (label.assetId === undefined ? undefined : `#${label.assetId}`))}`
  return kind
}

function verticalTitle(vertical: GraphVertical): { text: string; copy?: string } {
  switch (vertical.type) {
    case 'account':
      return { text: `(${vertical.accountNumber}) ${shorten(vertical.address, 10)}`, copy: vertical.address }
    case 'application':
      return { text: `app ${vertical.applicationId}`, copy: String(vertical.applicationId) }
    case 'asset':
      return { text: `asset ${vertical.assetId}`, copy: String(vertical.assetId) }
    case 'opUp':
      return { text: 'op-up' }
  }
}

function endpoints(row: GraphHorizontal): { from: number; to: number; loop: boolean } {
  const { representation } = row
  if (representation.kind === 'vector') {
    return representation.direction === 'leftToRight'
      ? { from: representation.fromVertical, to: representation.toVertical, loop: false }
      : { from: representation.toVertical, to: representation.fromVertical, loop: false }
  }
  return { from: representation.vertical, to: representation.vertical, loop: representation.kind === 'selfLoop' }
}

function tag(value: number | 'rekey' | undefined): string {
  return value === undefined ? '' : value === 'rekey' ? ' (rk)' : ` (${value})`
}

/** Below this width the lanes are unreadable; rows become a list. */
const LANES_MIN_WIDTH = 600

export function TransactionsGraphView({ graph }: { graph: TransactionsGraph }) {
  const [lanes, setLanes] = useState(true)
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${LANES_MIN_WIDTH}px)`)
    const update = () => setLanes(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const columns = graph.verticals.length
  if (!lanes || columns === 0) {
    return (
      <ol className="graph-list">
        {graph.horizontals.map((row, index) => {
          const { from, to, loop } = endpoints(row)
          const fromV = graph.verticals[from]
          const toV = graph.verticals[to]
          return (
            <li key={index} style={{ paddingLeft: `${row.depth}rem` }}>
              <span className="graph-label">{labelText(row.label)}</span>{' '}
              {fromV ? verticalTitle(fromV).text : '?'}
              {loop ? ' ↺' : row.representation.kind === 'point' ? '' : ` → ${toV ? verticalTitle(toV).text : '?'}`}
            </li>
          )
        })}
      </ol>
    )
  }
  const template = `repeat(${columns}, minmax(6rem, 1fr))`
  return (
    <div className="graph">
      <div className="graph-head" style={{ gridTemplateColumns: template }}>
        {graph.verticals.map((vertical, index) => {
          const title = verticalTitle(vertical)
          return (
            <span key={index} className="graph-vertical">
              {title.copy ? <Copyable value={title.copy} display={title.text} /> : title.text}
              {vertical.type !== 'opUp' && vertical.type !== 'asset' && vertical.associatedAccounts.length > 0
                ? vertical.associatedAccounts.map((account) => (
                    <span key={account.address} className="graph-assoc">
                      ({account.accountNumber}) {account.kind} {shorten(account.address, 8)}
                    </span>
                  ))
                : null}
            </span>
          )
        })}
      </div>
      {graph.horizontals.map((row, index) => {
        const { from, to, loop } = endpoints(row)
        const { representation } = row
        const left = Math.min(from, to)
        const right = Math.max(from, to)
        const rightToLeft = representation.kind === 'vector' && representation.direction === 'rightToLeft'
        return (
          <div key={index} className={`graph-row${row.isRemainder ? ' remainder' : ''}`} style={{ gridTemplateColumns: template }}>
            {graph.verticals.map((_, column) => (
              <span key={column} className="graph-lane" />
            ))}
            <span
              className={`graph-edge${loop ? ' loop' : representation.kind === 'point' ? ' point' : ''}${rightToLeft ? ' rtl' : ''}`}
              style={{ gridColumn: `${left + 1} / ${right + 2}` }}
            >
              <span className="graph-edge-line" />
              <span className="graph-label">
                {'─'.repeat(row.depth)}
                {labelText(row.label)}
                {tag(representation.fromTag)}
                {'toTag' in representation ? tag(representation.toTag) : ''}
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
