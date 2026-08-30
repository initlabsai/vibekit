'use client'

/** A Haystack quote: what you give, what you get, the venues that make the price. The button composes the swap. */
import { formatBaseUnits, type SwapQuote } from '@initlabs/vibekit/views'

import { Button, Fact, Facts, Frame, Header } from '../../primitives'

/** Venue bar segments, widest first; the label drops on narrow slices. */
export function routeSegments(
  route: SwapQuote['route'],
): Array<{ venue: string; width: number; label: string }> {
  const total = route.reduce((sum, leg) => sum + leg.percentage, 0) || 100
  return route.map((leg) => {
    const width = (leg.percentage / total) * 100
    return {
      venue: leg.venue,
      width,
      label: width >= 18 ? `${leg.venue} ${Math.round(leg.percentage)}%` : '',
    }
  })
}

export function SwapQuoteCard({
  data,
  network,
  onSwap,
}: {
  data: SwapQuote
  network: string
  onSwap?: () => void
}) {
  const amountIn = formatBaseUnits(data.amountIn, data.fromDecimals)
  const amountOut = formatBaseUnits(data.amountOut, data.toDecimals)
  const rate =
    Number(data.amountOut) /
    10 ** data.toDecimals /
    (Number(data.amountIn) / 10 ** data.fromDecimals)
  const impact = data.priceImpactPercent
  return (
    <Frame>
      <Header
        kicker="QUOTE"
        chip="HAYSTACK"
        pill={network.toUpperCase()}
        tone={impact !== undefined && impact > 1 ? 'warn' : 'idle'}
        action={onSwap ? <Button label="swap ▸" onPress={onSwap} /> : undefined}
      />
      <p className="hero">
        <span className="hero-value">
          {amountIn} {data.fromUnit} → {amountOut} {data.toUnit}
        </span>
        {Number.isFinite(rate) ? (
          <span className="hero-unit">
            1 {data.fromUnit} ≈ {rate.toPrecision(6).replace(/\.?0+$/, '')} {data.toUnit}
          </span>
        ) : null}
      </p>
      <div
        className="route-bar"
        role="img"
        aria-label={data.route
          .map((leg) => `${leg.venue} ${Math.round(leg.percentage)}%`)
          .join(', ')}
      >
        {routeSegments(data.route).map((segment, i) => (
          <span
            key={`${segment.venue}-${i}`}
            className={`route-seg route-seg-${i % 4}`}
            style={{ width: `${segment.width}%` }}
            title={`${segment.venue} ${Math.round(segment.width)}%`}
          >
            {segment.label}
          </span>
        ))}
      </div>
      <Facts>
        {impact === undefined ? null : (
          <Fact
            label="price impact"
            tone={impact > 1 ? 'danger' : undefined}
            value={`${impact.toFixed(2)}%`}
          />
        )}
        {data.usdIn !== undefined && data.usdOut !== undefined ? (
          <Fact label="usd" value={`$${data.usdIn.toFixed(2)} → $${data.usdOut.toFixed(2)}`} />
        ) : null}
        <Fact label="type" value={data.type === 'fixed-input' ? 'sell exactly' : 'buy exactly'} />
        {data.needsOptIn ? (
          <Fact label="opt-in" value={`${data.toUnit} opt-in rides in the group`} />
        ) : null}
      </Facts>
    </Frame>
  )
}
