'use client'

/** An NFD profile from a pasted name: the deposit address, verified handles, and a line of bio. */
import type { NfdRecord } from '@initlabs/vibekit/views'

import { Button, Copyable, Fact, Facts, Frame, Header } from '../../primitives'
import { shorten } from '../../theme'

/** Verified handles and links, in display order; each row copies its value. */
const LINKS: ReadonlyArray<[key: string, label: string]> = [
  ['twitter', 'twitter'],
  ['discord', 'discord'],
  ['github', 'github'],
  ['telegram', 'telegram'],
  ['email', 'email'],
  ['website', 'website'],
  ['domain', 'domain'],
  ['blueskydid', 'bluesky'],
  ['nostrpubkey', 'nostr'],
]

/** Row-major facts: common profiles pair app/twitter, then discord/github. */
export function nfdFactsFor(
  data: NfdRecord,
): ReadonlyArray<Readonly<{ label: string; value: string }>> {
  const props = data.properties ?? {}
  return [
    ...(data.appId === undefined ? [] : [{ label: 'app', value: String(data.appId) }]),
    ...(data.owner && data.owner !== data.address ? [{ label: 'owner', value: data.owner }] : []),
    ...LINKS.filter(([key]) => props[key]).map(([key, label]) => ({ label, value: props[key]! })),
  ]
}

export function NfdCard({
  data,
  network,
  onOpenAccount,
}: {
  data: NfdRecord
  network: string
  onOpenAccount?: () => void
}) {
  const props = data.properties ?? {}
  const facts = nfdFactsFor(data)
  const byline = props.name && props.name !== data.name ? props.name : undefined
  return (
    <Frame className="nfd-card">
      <Header
        kicker="NFD"
        chip={data.state}
        pill={network.toUpperCase()}
        action={onOpenAccount ? <Button label="account ▸" onPress={onOpenAccount} /> : undefined}
      />
      <div className="nfd-identity">
        {props.avatar?.startsWith('https://') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="identity-avatar" src={props.avatar} alt="" width={56} height={56} />
        ) : null}
        <div className="nfd-identity-body">
          <p className="hero nfd-name">
            <span className="hero-value">{data.name}</span>
            {byline ? <span className="hero-unit">{byline}</span> : null}
          </p>
          {data.address ? (
            <p className="nfd-address">
              <Copyable value={data.address} display={shorten(data.address, 26)} />
            </p>
          ) : null}
        </div>
      </div>
      <div className="nfd-facts">
        <Facts>
          {facts.map(({ label, value }) => (
            <Fact key={label} label={label}>
              <Copyable value={value} />
            </Fact>
          ))}
        </Facts>
      </div>
      {props.bio ? <p className="nfd-bio">{props.bio}</p> : null}
    </Frame>
  )
}
