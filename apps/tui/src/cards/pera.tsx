import type { AssetProfile } from '@initlabs/vibekit/plugins/pera'

import { COLORS, wrapLines } from '../theme.js'
import { Button, Fact, Frame, Header, Hero, innerWidth, Rule, type Tone } from '../ui.js'
import { trimPrice } from './market.js'

/** The tier is the card's whole point; suspicious must read as alarm. */
function tierTone(tier: string): Tone {
  if (tier === 'suspicious') return 'danger'
  if (tier === 'unverified') return 'warn'
  if (tier === 'trusted' || tier === 'verified') return 'ok'
  return 'idle'
}

/** Project handles and links, in display order; each row copies its value. */
const PROJECT_LINKS: ReadonlyArray<
  [key: keyof NonNullable<AssetProfile['project']>, label: string]
> = [
  ['url', 'website'],
  ['twitter', 'twitter'],
  ['discord', 'discord'],
  ['telegram', 'telegram'],
]

/** Pera's curated asset profile (the `pera.asset` view). */
export function PeraAssetCard({
  data,
  network,
  width,
  onOpen,
}: {
  data: AssetProfile
  network: string
  width: number
  /** Opens the on-chain asset card. */
  onOpen?: (assetId: number) => void
}) {
  const body = innerWidth(width)
  const project = data.project ?? {}
  const links = PROJECT_LINKS.filter(([key]) => project[key]).map(
    ([key, label]) => [label, project[key]!] as const,
  )
  const blurb = data.description ?? project.description
  const bio = blurb ? wrapLines(blurb, body).slice(0, 3) : []
  return (
    <Frame width={width}>
      <Header
        kicker="ASSET PROFILE"
        chip={network.toUpperCase()}
        pill={data.verificationTier.toUpperCase()}
        tone={tierTone(data.verificationTier)}
        action={
          onOpen ? <Button label="asset ▸" onPress={() => onOpen(data.assetId)} /> : undefined
        }
      />
      <Hero
        value={data.name ?? `Asset #${data.assetId}`}
        unit={data.unitName === data.name ? undefined : data.unitName}
      />
      <box marginTop={1} flexDirection="column">
        <Rule width={body} />
        <Fact label="id" value={String(data.assetId)} copy={String(data.assetId)} width={body} />
        {data.priceUsd ? (
          <Fact label="price" value={`$${trimPrice(data.priceUsd)}`} width={body} />
        ) : null}
        {data.isCollectible ? <Fact label="collectible" value="yes" width={body} /> : null}
        {project.name && project.name !== data.name ? (
          <Fact label="project" value={project.name} width={body} />
        ) : null}
        {data.url && data.url !== project.url ? (
          <Fact label="url" value={data.url} copy={data.url} width={body} />
        ) : null}
        {links.map(([label, value]) => (
          <Fact key={label} label={label} value={value} copy={value} width={body} />
        ))}
        {bio.length > 0 ? <text fg={COLORS.muted} marginTop={1} content={bio.join('\n')} /> : null}
      </box>
    </Frame>
  )
}
