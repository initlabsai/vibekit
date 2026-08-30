import type { NetworkStatusViewModel } from '@initlabs/vibekit/views'

import { Frame, Header, Hero, innerWidth, StatGrid, Unavailable } from '../../primitives.js'

export function NetworkCard({
  model,
  width,
}: {
  model: NetworkStatusViewModel | undefined
  width: number
}) {
  if (!model) return <Unavailable title="NETWORK" width={width} />
  const body = innerWidth(width)
  const stats = [
    {
      label: 'round',
      value: String(model.latestRound),
      copy: String(model.latestRound),
    },
    { label: 'block', value: `${model.avgBlockTime}s` },
    { label: 'online', value: String(model.participation) },
  ]
  return (
    <Frame width={width}>
      <Header kicker="NETWORK" pill={model.network.toUpperCase()} tone="idle" />
      <Hero value={String(model.avgTps)} unit="TPS" />
      <StatGrid items={stats} width={body} />
    </Frame>
  )
}
