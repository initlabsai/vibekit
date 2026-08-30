'use client'

/** An asset's USD price over a range: the line, the last close, and the move across the range. */
import { useState } from 'react'
import type { AssetHistory } from '@initlabs/vibekit/views'

import { AssetMark, Button, Fact, Facts, FooterNote, Frame, Header } from '../../primitives'
import { chartGeometry } from '../network/chart'
import { compactUsd, trimPrice } from './market-cards'

const W = 400
const H = 96
const RANGES: ReadonlyArray<AssetHistory['range']> = ['1d', '7d', '30d', '90d', '1y']

/** `$0.0864` — trims to significant digits; sub-cent prices keep their zeros. */
export function priceLabel(value: number): string {
  return `$${trimPrice(value.toFixed(value < 1 ? 10 : 4))}`
}

function dateLabel(seconds: number, intervalSeconds: number): string {
  const d = new Date(seconds * 1000)
  return intervalSeconds < 86400
    ? d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function PriceHistoryCard({
  data,
  network,
  onRange,
  loading,
  onOpen,
}: {
  data: AssetHistory
  network: string
  /** Re-runs the lookup on another range, in place. */
  onRange?: (range: AssetHistory['range']) => void
  loading?: boolean
  onOpen?: (assetId: number) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const candles = data.candles
  const { xs, ys } = chartGeometry(
    candles.map((c) => c.close),
    W,
    H,
  )
  const first = candles[0]
  const last = candles[candles.length - 1]
  const change =
    first && last && first.open > 0 ? ((last.close - first.open) / first.open) * 100 : undefined
  const hovered = hover === null ? undefined : candles[hover]
  const slice = candles.length > 0 ? W / candles.length : W
  const line = xs.map((x, i) => `${x},${ys[i]}`).join(' ')
  const volume = candles.reduce((sum, c) => sum + c.volumeUsd, 0)
  const low = candles.length ? Math.min(...candles.map((c) => c.low)) : undefined
  const high = candles.length ? Math.max(...candles.map((c) => c.high)) : undefined
  const interval =
    data.intervalSeconds >= 86400
      ? `${data.intervalSeconds / 86400}d`
      : `${data.intervalSeconds / 3600}h`
  return (
    <Frame>
      <Header
        kicker="PRICE"
        chip="VESTIGE"
        pill={network.toUpperCase()}
        tone="idle"
        action={
          onOpen && data.assetId !== 0 ? (
            <Button label="asset ▸" onPress={() => onOpen(data.assetId)} />
          ) : undefined
        }
      />
      <p className="hero">
        <span className="hero-value asset-hero">
          {data.assetId === 0 ? 'ALGO' : <AssetMark assetId={data.assetId} />}
        </span>
        {last ? <span className="hero-unit">{priceLabel(last.close)}</span> : null}
        {change === undefined ? null : (
          <span className={`hero-unit ${change >= 0 ? 'delta-up' : 'delta-down'}`}>
            {change >= 0 ? '+' : ''}
            {change.toFixed(2)}% · {data.range}
          </span>
        )}
      </p>
      {xs.length === 0 ? (
        <FooterNote text="No candles for this range." />
      ) : (
        <div className="tps">
          <p className="tps-caption">
            {hovered ? (
              <>
                <span>{dateLabel(hovered.time, data.intervalSeconds)}</span>
                <span>
                  <b>{priceLabel(hovered.close)}</b> · vol <b>{compactUsd(hovered.volumeUsd)}</b>
                </span>
              </>
            ) : (
              <span>
                {candles.length} candles · {interval} each
              </span>
            )}
          </p>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="tps-svg"
            preserveAspectRatio="none"
            role="img"
            aria-label={`USD price over ${data.range}`}
          >
            <polygon points={`0,${H} ${line} ${W},${H}`} className="tps-fill" />
            <polyline points={line} className="tps-line" vectorEffect="non-scaling-stroke" />
            {hover === null ? null : (
              <>
                <line
                  x1={xs[hover]}
                  x2={xs[hover]}
                  y1={ys[hover]}
                  y2={H}
                  className="tps-cursor"
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx={xs[hover]} cy={ys[hover]} r={3} className="tps-dot" />
              </>
            )}
            {xs.map((x, i) => (
              <rect
                key={i}
                x={x - slice / 2}
                y={0}
                width={slice}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </svg>
        </div>
      )}
      {onRange ? (
        <p className="range-chips">
          {RANGES.map((range) => (
            <Button
              key={range}
              label={range}
              active={range === data.range}
              disabled={loading}
              onPress={() => onRange(range)}
            />
          ))}
        </p>
      ) : null}
      <Facts>
        {low !== undefined ? <Fact label="low" value={priceLabel(low)} /> : null}
        {high !== undefined ? <Fact label="high" value={priceLabel(high)} /> : null}
        <Fact label="volume" value={compactUsd(volume)} />
        {last && last.confidence < 0.5 ? (
          <Fact label="confidence" value={`low (${last.confidence.toFixed(2)})`} />
        ) : null}
      </Facts>
    </Frame>
  )
}
