'use client'

/** An NFD profile from a pasted name: the deposit address, verified handles, and a line of bio. */
import { Button, Copyable, Fact, Facts, FooterNote, Frame, Header, Hero } from '../../primitives'
import type { NfdProfile } from '../../remote-host'

/** Verified handles and links, in display order; each row copies its value. */
const LINKS: ReadonlyArray<[key: string, label: string]> = [
  ['twitter', 'twitter'],
  ['github', 'github'],
  ['discord', 'discord'],
  ['telegram', 'telegram'],
  ['email', 'email'],
  ['website', 'website'],
  ['domain', 'domain'],
  ['blueskydid', 'bluesky'],
  ['nostrpubkey', 'nostr'],
]

export function NfdCard({
  data,
  network,
  onOpenAccount,
}: {
  data: NfdProfile
  network: string
  onOpenAccount?: () => void
}) {
  const props = data.properties ?? {}
  const links = LINKS.filter(([key]) => props[key]).map(([key, label]) => [label, props[key]!] as const)
  const byline = props.name && props.name !== data.name ? props.name : undefined
  return (
    <Frame>
      <Header
        kicker="NFD"
        chip={data.state}
        pill={network.toUpperCase()}
        action={onOpenAccount ? <Button label="account ▸" onPress={onOpenAccount} /> : undefined}
      />
      <Hero value={data.name} copy={data.name} unit={byline} />
      <Facts>
        {data.appId === undefined ? null : <Fact label="app" value={String(data.appId)} copy={String(data.appId)} />}
        {data.address ? <Fact label="address" value={data.address} copy={data.address} /> : null}
        {data.owner && data.owner !== data.address ? <Fact label="owner" value={data.owner} copy={data.owner} /> : null}
        {links.map(([label, value]) => (
          <Fact key={label} label={label}>
            <Copyable value={value} />
          </Fact>
        ))}
      </Facts>
      {props.bio ? <FooterNote text={props.bio} /> : null}
    </Frame>
  )
}
