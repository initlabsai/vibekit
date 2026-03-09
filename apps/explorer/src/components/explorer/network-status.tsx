'use client'

import React from 'react'
import { Timer, Users, Box, Globe } from 'lucide-react'

interface NetworkStatusProps {
  data: Record<string, unknown>
}

interface BlockDetail {
  round: number
  txnCount: number
  blockTime: number
  tps: number
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(1)
}

function getHealthGrade(avgTps: number, avgBlockTime: number, participation: number) {
  let score = 0
  if (avgBlockTime > 0 && avgBlockTime < 4) score++
  if (avgBlockTime > 0 && avgBlockTime < 3.5) score++
  if (avgTps > 5) score++
  if (avgTps > 15) score++
  if (participation > 25) score++
  if (participation > 35) score++

  if (score >= 5) return { label: 'Excellent', color: 'text-green-400', dot: 'bg-green-400' }
  if (score >= 4) return { label: 'Good', color: 'text-green-400', dot: 'bg-green-400' }
  if (score >= 3) return { label: 'Normal', color: 'text-algo-teal', dot: 'bg-algo-teal' }
  if (score >= 2) return { label: 'Degraded', color: 'text-yellow-400', dot: 'bg-yellow-400' }
  return { label: 'Poor', color: 'text-red-400', dot: 'bg-red-400' }
}

function TpsChart({ blocks, color }: { blocks: BlockDetail[]; color: string }) {
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null)

  if (blocks.length < 2) return null
  const data = blocks.map((b) => b.tps)
  const max = Math.max(...data, 1)
  const min = Math.min(...data)
  const w = 400
  const h = 90
  const padY = 6
  const tickH = 10
  const chartH = h - tickH
  const range = max - min || 1

  const xs = data.map((_, i) => (i / (data.length - 1)) * w)
  const ys = data.map((v) => chartH - padY - ((v - min) / range) * (chartH - padY * 2))
  const points = xs.map((x, i) => `${x},${ys[i]}`).join(' ')
  const fillPath = `0,${chartH} ${points} ${w},${chartH}`

  const hovered = hoverIdx !== null ? blocks[hoverIdx] : null

  return (
    <div className="relative">
      {/* Hover info bar */}
      <div className="flex items-center justify-between mb-1 h-4">
        {hovered ? (
          <>
            <span className="text-[10px] text-algo-muted">
              Round <span className="text-white font-medium">{hovered.round.toLocaleString()}</span>
            </span>
            <span className="text-[10px] text-algo-muted">
              <span className="text-white font-medium">{hovered.tps}</span> TPS
              <span className="mx-1.5 text-algo-border">|</span>
              <span className="text-white font-medium">{hovered.txnCount}</span> txns
              <span className="mx-1.5 text-algo-border">|</span>
              <span className="text-white font-medium">{hovered.blockTime}s</span> block
            </span>
          </>
        ) : (
          <span className="text-[10px] text-algo-muted uppercase tracking-wider">
            {blocks.length} blocks
          </span>
        )}
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[90px]" preserveAspectRatio="none">
          <defs>
            <linearGradient id="tpsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={fillPath} fill="url(#tpsFill)" />
          <polyline points={xs.map((x, i) => `${x},${ys[i]}`).join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />

          {/* Axis line + ticks */}
          <line x1="0" y1={chartH} x2={w} y2={chartH} stroke="currentColor" className="text-algo-border" strokeWidth="0.5" />
          {xs.map((x, i) => (
            <line key={i} x1={x} y1={chartH} x2={x} y2={chartH + 4} stroke="currentColor" className="text-algo-muted" strokeWidth="1" opacity="0.4" />
          ))}

          {/* Hover crosshair */}
          {hoverIdx !== null && (
            <line x1={xs[hoverIdx]} y1={0} x2={xs[hoverIdx]} y2={chartH} stroke={color} strokeWidth="1" opacity="0.4" />
          )}

          {/* Invisible hit areas per data point */}
          {xs.map((x, i) => {
            const sliceW = w / data.length
            return (
              <rect
                key={i}
                x={x - sliceW / 2}
                y={0}
                width={sliceW}
                height={h}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ cursor: 'crosshair' }}
              />
            )
          })}
        </svg>

        {/* HTML dot overlay — positioned relative to SVG container */}
        {hoverIdx !== null && (
          <div
            className="absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              backgroundColor: color,
              left: `${(xs[hoverIdx] / w) * 100}%`,
              top: `${(ys[hoverIdx] / h) * 100}%`,
            }}
          />
        )}
      </div>
    </div>
  )
}

export function NetworkStatus({ data }: NetworkStatusProps) {
  const latestRound = data.latestRound as number
  const avgTps = data.avgTps as number
  const peakTps = data.peakTps as number
  const avgBlockTime = data.avgBlockTime as number
  const avgTxnPerBlock = data.avgTxnPerBlock as number
  const totalSupply = data.totalSupply as number
  const onlineStake = data.onlineStake as number
  const participation = data.participation as number
  const timeSinceLastRound = data.timeSinceLastRound as number
  const genesisId = (data.genesisId ?? '') as string
  const consensusVersion = (data.consensusVersion ?? '') as string
  const blockDetails = (data.blockDetails ?? []) as BlockDetail[]

  const health = getHealthGrade(avgTps, avgBlockTime, participation)
  const versionShort = consensusVersion.split('/').filter(Boolean).pop() ?? ''
  const networkName = genesisId ? genesisId.replace(/-v\d.*$/, '') : ''

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card overflow-hidden">
      {/* Header: TPS headline + health */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{avgTps}</span>
          <span className="text-sm text-algo-muted">TPS</span>
          <span className="text-xs text-algo-muted ml-1">peak {peakTps}</span>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${health.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${health.dot}`} />
          {health.label}
        </div>
      </div>

      {/* TPS chart — full width, interactive */}
      {blockDetails.length > 1 && (
        <div className="px-4 pb-2">
          <TpsChart blocks={blockDetails} color="#14b8a6" />
        </div>
      )}

      {/* Key metrics strip */}
      <div className="grid grid-cols-4 gap-px bg-algo-border/50 border-t border-algo-border">
        <MetricCell icon={<Timer className="w-3.5 h-3.5" />} label="Last Block" value={`${timeSinceLastRound}s ago`} />
        <MetricCell icon={<Box className="w-3.5 h-3.5" />} label="Txn/Block" value={String(avgTxnPerBlock)} />
        <MetricCell icon={<Users className="w-3.5 h-3.5" />} label="Participation" value={`${participation}%`} />
        <MetricCell label="Round" value={latestRound.toLocaleString()} copyValue={String(latestRound)} />
      </div>

      {/* Supply footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-algo-border text-xs text-algo-muted">
        <span>
          Online <span className="font-bold text-white">{formatCompact(onlineStake)}</span>
          <span className="mx-1.5 text-algo-border">/</span>
          Supply <span className="font-bold text-white">{formatCompact(totalSupply)} ALGO</span>
        </span>
        {networkName && (
          <span className="flex items-center gap-1 text-[10px]">
            <Globe className="w-3 h-3" />
            <span className="capitalize">{networkName}</span>
            {versionShort && <span className="text-algo-border ml-1">{versionShort}</span>}
          </span>
        )}
      </div>
    </div>
  )
}

function MetricCell({ icon, label, value, copyValue }: { icon?: React.ReactNode; label: string; value: string; copyValue?: string }) {
  return (
    <div className="bg-algo-card px-3 py-2.5 text-center">
      <div className="flex items-center justify-center gap-1 text-algo-muted text-[10px] uppercase tracking-wider mb-1">
        {icon}
        {label}
      </div>
      {copyValue ? (
        <CopyableValue value={value} copyValue={copyValue} />
      ) : (
        <p className="text-sm font-bold">{value}</p>
      )}
    </div>
  )
}

function CopyableValue({ value, copyValue }: { value: string; copyValue: string }) {
  const [copied, setCopied] = React.useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(copyValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-sm font-bold cursor-pointer hover:text-algo-teal transition-colors"
    >
      {value}
      {copied ? (
        <svg className="w-3 h-3 text-green-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg className="w-3 h-3 opacity-40 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
      )}
    </button>
  )
}
