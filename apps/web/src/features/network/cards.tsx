import type { NetworkStatusViewModel } from '@initlabs/vibekit-explorer'

import { Fact, Facts, Frame, Header, Hero, Unavailable } from '../../primitives'

export function NetworkCard({ model }: { model: NetworkStatusViewModel | undefined }) {
  if (!model) return <Unavailable title="NETWORK" />
  return (
    <Frame>
      <Header kicker="NETWORK" pill={model.network.toUpperCase()} tone="idle" />
      <Hero value={String(model.avgTps)} unit="TPS" />
      <Facts>
        <Fact label="round" value={String(model.latestRound)} copy={String(model.latestRound)} />
        <Fact label="block" value={`${model.avgBlockTime}s`} />
        <Fact label="online" value={String(model.participation)} />
      </Facts>
    </Frame>
  )
}
