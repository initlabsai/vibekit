'use client'

/** Pera's curated asset profile: the verification tier is the whole point. */
import type { AssetProfile } from '@initlabs/vibekit-explorer'

import {
  Button,
  Copyable,
  Fact,
  Facts,
  Frame,
  Header,
  TierBadge,
  type Tone,
} from '../../primitives'
import type { Tier } from '../../enrich'
import { trimPrice } from './market-cards'

function tierTone(tier: string): Tone {
  if (tier === 'suspicious') return 'danger'
  if (tier === 'unverified') return 'warn'
  if (tier === 'trusted' || tier === 'verified') return 'ok'
  return 'idle'
}

const PROJECT_LINKS: ReadonlyArray<
  [key: keyof NonNullable<AssetProfile['project']>, label: string]
> = [
  ['url', 'website'],
  ['twitter', 'twitter'],
  ['discord', 'discord'],
  ['telegram', 'telegram'],
]

export function PeraAssetCard({
  data,
  network,
  onOpen,
}: {
  data: AssetProfile
  network: string
  onOpen?: (assetId: number) => void
}) {
  const project = data.project ?? {}
  const links = PROJECT_LINKS.filter(([key]) => project[key]).map(
    ([key, label]) => [label, project[key]!] as const,
  )
  const blurb = data.description ?? project.description
  const title = data.name ?? data.unitName ?? `Asset #${data.assetId}`
  return (
    <Frame tone={data.verificationTier === 'suspicious' ? 'danger' : undefined}>
      <Header
        kicker="ASSET PROFILE"
        chip="PERA"
        pill={network.toUpperCase()}
        tone={tierTone(data.verificationTier)}
        action={
          onOpen ? <Button label="asset ▸" onPress={() => onOpen(data.assetId)} /> : undefined
        }
      />
      <p className="hero">
        <span className="hero-value asset-hero">
          {data.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="asset-logo asset-logo-lg"
              src={data.logoUrl}
              alt=""
              width={40}
              height={40}
            />
          ) : null}
          {title}
          <TierBadge tier={data.verificationTier as Tier} />
        </span>
        {data.priceUsd !== undefined ? (
          <span className="hero-unit">${trimPrice(data.priceUsd)}</span>
        ) : null}
      </p>
      <Facts>
        <Fact label="id" value={String(data.assetId)} copy={String(data.assetId)} />
        <Fact label="tier" value={data.verificationTier} />
        {data.unitName ? <Fact label="unit" value={data.unitName} /> : null}
        {data.isCollectible ? <Fact label="kind" value="collectible" /> : null}
        {project.name ? <Fact label="project" value={project.name} /> : null}
        {links.map(([label, value]) => (
          <Fact key={label} label={label}>
            <Copyable value={value} />
          </Fact>
        ))}
      </Facts>
      {blurb ? <p className="nfd-bio">{blurb}</p> : null}
    </Frame>
  )
}
