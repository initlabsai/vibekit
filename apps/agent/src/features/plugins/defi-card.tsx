'use client'

/** Algorand DeFi by protocol: TVL bars, biggest first. */
import type { DefiProtocols } from '@initlabs/vibekit-explorer'

import { FooterNote, Frame, Header } from '../../primitives'
import { compactUsd } from './market-cards'

export function DefiOverviewCard({ data, network }: { data: DefiProtocols; network: string }) {
  const active = data.protocols.filter((p) => p.active && p.tvlUsd > 0)
  const max = active[0]?.tvlUsd ?? 1
  return (
    <Frame>
      <Header kicker="DEFI" chip="VESTIGE" pill={network.toUpperCase()} tone="idle" />
      <p className="hero">
        <span className="hero-value">{compactUsd(data.totalTvlUsd)}</span>
        <span className="hero-unit">total value locked</span>
      </p>
      {active.length === 0 ? (
        <FooterNote text="No protocols reported." />
      ) : (
        <ol className="tvl-bars">
          {active.map((p) => (
            <li key={p.id} className="tvl-row">
              <span className="tvl-name">
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.name} <span className="muted">{p.version}</span>
                  </a>
                ) : (
                  <>
                    {p.name} <span className="muted">{p.version}</span>
                  </>
                )}
              </span>
              <span className="tvl-bar" aria-hidden>
                <span
                  className="tvl-fill"
                  style={{ width: `${Math.max(1, (p.tvlUsd / max) * 100)}%` }}
                />
              </span>
              <span className="tvl-value">{compactUsd(p.tvlUsd)}</span>
            </li>
          ))}
        </ol>
      )}
    </Frame>
  )
}
