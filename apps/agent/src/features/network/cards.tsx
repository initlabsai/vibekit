'use client'

/** Network health: the TPS headline, a line over the sampled blocks, and the numbers that explain it. */
import type { NetworkStatusViewModel } from '@initlabs/vibekit-explorer'
import { useState } from 'react'

import { Copyable, Frame, Header, Unavailable } from '../../primitives'
import { chartGeometry, compact } from './chart'

const W = 400
const H = 80

type BlockDetail = NonNullable<NetworkStatusViewModel['blockDetails']>[number]

function TpsChart({ blocks }: { blocks: ReadonlyArray<BlockDetail> }) {
  const [hover, setHover] = useState<number | null>(null)
  const { xs, ys } = chartGeometry(blocks.map((b) => b.tps), W, H)
  if (xs.length === 0) return null
  const line = xs.map((x, i) => `${x},${ys[i]}`).join(' ')
  const hovered = hover === null ? undefined : blocks[hover]
  const slice = W / blocks.length
  return (
    <div className="tps">
      <p className="tps-caption">
        {hovered ? (
          <>
            <span>round <b>{hovered.round}</b></span>
            <span><b>{hovered.tps}</b> tps · <b>{hovered.txnCount}</b> txns · <b>{hovered.blockTime}s</b></span>
          </>
        ) : (
          <span>tps over the last {blocks.length} blocks</span>
        )}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="tps-svg" preserveAspectRatio="none" role="img" aria-label="transactions per second, recent blocks">
        <polygon points={`0,${H} ${line} ${W},${H}`} className="tps-fill" />
        <polyline points={line} className="tps-line" vectorEffect="non-scaling-stroke" />
        {hover === null ? null : (
          <>
            <line x1={xs[hover]} x2={xs[hover]} y1={ys[hover]} y2={H} className="tps-cursor" vectorEffect="non-scaling-stroke" />
            <circle cx={xs[hover]} cy={ys[hover]} r={3} className="tps-dot" />
          </>
        )}
        {xs.map((x, i) => (
          <rect key={i} x={x - slice / 2} y={0} width={slice} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </svg>
    </div>
  )
}

function Metric({ label, value, copy }: { label: string; value: string; copy?: string }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      {copy ? <Copyable value={copy} display={value} className="metric-value" /> : <span className="metric-value">{value}</span>}
    </div>
  )
}

export function NetworkCard({ model }: { model: NetworkStatusViewModel | undefined }) {
  if (!model) return <Unavailable title="NETWORK" />
  const supply = model.totalSupplyMicroAlgos === undefined ? undefined : Number(model.totalSupplyMicroAlgos) / 1e6
  const online = model.onlineStakeMicroAlgos === undefined ? undefined : Number(model.onlineStakeMicroAlgos) / 1e6
  // Consensus versions are URLs ending in a long hash; the first octet identifies it.
  const version = model.consensusVersion?.split('/').filter(Boolean).pop()?.slice(0, 8)
  return (
    <Frame>
      <Header kicker="NETWORK" pill={model.network.toUpperCase()} tone="idle" />
      <p className="hero">
        <span className="hero-value">{model.avgTps}</span>
        <span className="hero-unit">TPS</span>
        {model.peakTps === undefined ? null : <span className="hero-aside">peak {model.peakTps}</span>}
      </p>
      {model.blockDetails && model.blockDetails.length > 1 ? <TpsChart blocks={model.blockDetails} /> : null}
      <div className="metrics">
        <Metric label="round" value={model.latestRound.toLocaleString()} copy={String(model.latestRound)} />
        <Metric label="last block" value={model.timeSinceLastRound === undefined ? `${model.avgBlockTime}s avg` : `${model.timeSinceLastRound}s ago`} />
        {model.avgTxnPerBlock === undefined ? <Metric label="block time" value={`${model.avgBlockTime}s`} /> : <Metric label="txn / block" value={String(model.avgTxnPerBlock)} />}
        <Metric label="participation" value={`${model.participation}%`} />
      </div>
      {supply === undefined && !version ? null : (
        <p className="net-foot">
          {online !== undefined && supply !== undefined ? (
            <span>online <b>{compact(online)}</b> / supply <b>{compact(supply)}</b> ALGO</span>
          ) : null}
          {version ? <span className="net-version">{version}</span> : null}
        </p>
      )}
    </Frame>
  )
}
