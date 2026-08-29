import { formatMicroAlgos } from '@initlabs/vibekit-explorer'
import type { NfdList, NfdRecord } from '@initlabs/vibekit/plugins/nfd'

import { ListCard } from '../../generic-cards.js'
import { COLORS, shorten, wrapLines } from '../../theme.js'
import { Button, Fact, Frame, Header, Ident, innerWidth, Rule } from '../../primitives.js'

/** NFD's notched-square logomark, in blocks. */
const MARK = ['▙  ███', '██▙███', '██████']

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
  width,
  onOpenAccount,
}: {
  data: NfdRecord
  network: string
  width: number
  /** Opens the deposit account's card. */
  onOpenAccount?: () => void
}) {
  const body = innerWidth(width)
  const props = data.properties ?? {}
  const links = LINKS.filter(([key]) => props[key]).map(
    ([key, label]) => [label, props[key]!] as const,
  )
  const byline = props.name && props.name !== data.name ? props.name : undefined
  const bio = props.bio ? wrapLines(props.bio, body).slice(0, 3) : []
  return (
    <Frame width={width}>
      <Header
        kicker="NFD"
        chip={data.state}
        pill={network.toUpperCase()}
        action={onOpenAccount ? <Button label="account ▸" onPress={onOpenAccount} /> : undefined}
      />
      <box flexDirection="row" marginTop={1} height={3}>
        <text fg={COLORS.brassBright} content={MARK.join('\n')} />
        <box flexDirection="column" marginLeft={2}>
          <Ident value={data.name} width={Math.max(8, body - 8)} color={COLORS.brassBright} />
          <text fg={COLORS.muted} content={byline ?? ' '} />
          <text fg={COLORS.faint} content={data.appId !== undefined ? `app ${data.appId}` : ' '} />
        </box>
      </box>
      <box marginTop={1} flexDirection="column">
        <Rule width={body} />
        {data.address ? (
          <Fact label="address" value={data.address} copy={data.address} width={body} />
        ) : null}
        {data.owner && data.owner !== data.address ? (
          <Fact label="owner" value={data.owner} copy={data.owner} width={body} />
        ) : null}
        {links.map(([label, value]) => (
          <Fact key={label} label={label} value={value} copy={value} width={body} />
        ))}
        {bio.length > 0 ? <text fg={COLORS.muted} marginTop={1} content={bio.join('\n')} /> : null}
      </box>
    </Frame>
  )
}

/** Names matching a fragment (the `nfd.list` view). */
export function NfdListCard({
  data,
  network,
  width,
  onOpen,
}: {
  data: NfdList
  network: string
  width: number
  onOpen?: (name: string) => void
}) {
  return (
    <ListCard
      kicker="NAMES"
      chip="NFD"
      pill={network.toUpperCase()}
      rows={data.nfds}
      keyOf={(n) => n.name}
      lead={(n) => ({ label: 'name', value: n.name, copy: n.name })}
      onOpen={onOpen && ((n) => onOpen(n.name))}
      facts={(n, body) => (
        <Fact
          label="state"
          value={`${n.state ?? '—'}${n.owner ? ` · ${shorten(n.owner, 12)}` : ''}${n.sellAmountMicroAlgos ? ` · asks ${formatMicroAlgos(n.sellAmountMicroAlgos)} ALGO` : ''}`}
          width={body}
        />
      )}
      width={width}
    />
  )
}
