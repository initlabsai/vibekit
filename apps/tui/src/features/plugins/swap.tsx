/** A Haystack quote (the `haystack.quote` view): in → out, venues, impact. */
import { formatBaseUnits } from '@initlabs/vibekit-explorer'
import type { SwapQuote } from '@initlabs/vibekit/plugins/haystack'

import { Fact, Frame, Header, Hero, innerWidth } from '../../primitives.js'
import { COLORS } from '../../theme.js'

export function SwapQuoteCard({
  data,
  network,
  width,
}: {
  data: SwapQuote
  network: string
  width: number
}) {
  const body = innerWidth(width)
  const amountIn = `${formatBaseUnits(data.amountIn, data.fromDecimals)} ${data.fromUnit}`
  const amountOut = `${formatBaseUnits(data.amountOut, data.toDecimals)} ${data.toUnit}`
  const bar = Math.max(8, Math.min(40, body - 2))
  const impact = data.priceImpactPercent
  return (
    <Frame width={width}>
      <Header
        kicker="QUOTE"
        chip="HAYSTACK"
        pill={network.toUpperCase()}
        tone={impact !== undefined && impact > 1 ? 'warn' : undefined}
      />
      <Hero value={`${amountIn} → ${amountOut}`} />
      <box marginTop={1} flexDirection="row">
        {data.route.map((leg, i) => (
          <text key={`${leg.venue}-${i}`} fg={i % 2 === 0 ? COLORS.signal : COLORS.brass}>
            {'█'.repeat(Math.max(1, Math.round((leg.percentage / 100) * bar)))}
          </text>
        ))}
      </box>
      <box flexDirection="column">
        <Fact
          label="route"
          value={data.route.map((leg) => `${leg.venue} ${Math.round(leg.percentage)}%`).join(' · ')}
          width={body}
        />
        {impact === undefined ? null : (
          <Fact label="impact" value={`${impact.toFixed(2)}%`} width={body} />
        )}
        {data.usdIn !== undefined && data.usdOut !== undefined ? (
          <Fact
            label="usd"
            value={`$${data.usdIn.toFixed(2)} → $${data.usdOut.toFixed(2)}`}
            width={body}
          />
        ) : null}
        {data.needsOptIn ? (
          <Fact label="opt-in" value={`${data.toUnit} opt-in rides in the group`} width={body} />
        ) : null}
      </box>
    </Frame>
  )
}
