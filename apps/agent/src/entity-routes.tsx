/**
 * Shared machinery for the public entity routes: metadata, the human-facing
 * summary page, and the OG image response. Each route file stays a thin
 * binding of (kind, resolver) to the file conventions. The OG image carries
 * the resolution's cache-control so a miss never sticks anywhere.
 */
import { ImageResponse } from 'next/og'
import type { Metadata } from 'next'

import {
  parseEntityRef,
  type EntityCardModel,
  type Resolution,
  type LiveNetworkId,
} from './entity-og'
import { EntityOgCard, EntityOgMiss } from './entity-og-card'
import { ogFonts } from './og-fonts'
import { shorten } from './theme'

export type EntityKind = 'transaction' | 'asset' | 'application' | 'block'
export type Resolver = (network: LiveNetworkId, key: string) => Promise<Resolution<EntityCardModel>>

const OG_SIZE = { width: 1200, height: 630 }

function titleOf(card: EntityCardModel): string {
  switch (card.kind) {
    case 'transaction':
      return card.amount
        ? `${card.amount} — ${card.typeLabel.toLowerCase()} confirmed`
        : `${card.typeLabel.toLowerCase()} confirmed`
    case 'asset':
      return `${card.name} — ASA ${card.id}`
    case 'application':
      return `application ${card.id}`
    case 'block':
      return `block ${card.round}`
  }
}

function descriptionOf(card: EntityCardModel): string {
  switch (card.kind) {
    case 'transaction':
      return card.round
        ? `confirmed on ${card.network} in round ${card.round}`
        : `confirmed on ${card.network}`
    case 'asset':
      return `ASA ${card.id} on ${card.network}`
    case 'application':
      return `application ${card.id} on ${card.network}`
    case 'block':
      return `${card.txnCount} transactions · ${card.time}`
  }
}

/** Full values — the page renders these selectable; the OG card shortens its own. */
function factsOf(card: EntityCardModel): Array<[string, string]> {
  switch (card.kind) {
    case 'transaction':
      return (
        [
          ['type', card.typeLabel],
          card.amount ? ['amount', card.amount] : undefined,
          ['from', card.sender],
          card.to ? ['to', card.to] : undefined,
          ['fee', card.fee],
          card.round ? ['round', String(card.round)] : undefined,
          card.time ? ['time', card.time] : undefined,
          card.created ? ['created', card.created] : undefined,
          ['txn id', card.id],
        ] as Array<[string, string] | undefined>
      ).filter((fact): fact is [string, string] => !!fact)
    case 'asset':
      return (
        [
          ['name', card.name],
          card.unitName ? ['unit', card.unitName] : undefined,
          ['total supply', card.total],
          ['decimals', String(card.decimals)],
          ['creator', card.creator],
          card.url ? ['url', card.url] : undefined,
        ] as Array<[string, string] | undefined>
      ).filter((fact): fact is [string, string] => !!fact)
    case 'application':
      return (
        [
          ['creator', card.creator],
          ['global state', `${card.globalStateCount} entries`],
          ['schema', `${card.globalUints} uints · ${card.globalBytes} byte slices`],
          card.extraPages ? ['extra pages', String(card.extraPages)] : undefined,
        ] as Array<[string, string] | undefined>
      ).filter((fact): fact is [string, string] => !!fact)
    case 'block':
      return (
        [
          ['time', card.time],
          ['transactions', String(card.txnCount)],
          card.proposer ? ['proposer', card.proposer] : undefined,
        ] as Array<[string, string] | undefined>
      ).filter((fact): fact is [string, string] => !!fact)
  }
}

export async function entityMetadata(
  kind: EntityKind,
  ref: string[] | undefined,
  resolve: Resolver,
): Promise<Metadata> {
  const parsed = parseEntityRef(ref)
  if (!parsed) return { title: `qt314 — unknown ${kind}` }
  // The poster route, not the file convention — that can't live in a catch-all.
  const image = {
    url: `/og/${kind}/${(ref ?? []).map(encodeURIComponent).join('/')}`,
    width: 1200,
    height: 630,
  }
  const resolution = await resolve(parsed.network, parsed.key)
  if (resolution.state !== 'found') {
    const title = `qt314 — ${kind} ${shorten(parsed.key, 24)}`
    const description =
      resolution.state === 'pending'
        ? 'confirming on the network…'
        : `no such ${kind} on ${parsed.network}`
    return {
      title,
      description,
      openGraph: { title, description, siteName: 'qt314', images: [image] },
      twitter: { card: 'summary_large_image', title, description },
    }
  }
  const title = titleOf(resolution.card)
  // One quiet line — the poster carries the details.
  const description = descriptionOf(resolution.card)
  return {
    title: `qt314 — ${title}`,
    description,
    openGraph: { title, description, siteName: 'qt314', images: [image] },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export async function EntityPage({
  kind,
  ref,
  resolve,
}: {
  kind: EntityKind
  ref: string[] | undefined
  resolve: Resolver
}) {
  const parsed = parseEntityRef(ref)
  const resolution = parsed && (await resolve(parsed.network, parsed.key))
  const network = parsed?.network ?? 'mainnet'
  if (!parsed || !resolution || resolution.state !== 'found') {
    const pending = resolution && resolution.state === 'pending'
    return (
      <main className="share-page">
        <p className="share-brand">
          ◆ QT314 <b>AGENT</b>
        </p>
        <h1 className="share-prompt">
          {pending ? 'confirming…' : `no such ${kind} here.`}
          <span className={`prompt-net net-${network}`}>{network}</span>
        </h1>
        <p className="muted">
          {pending
            ? 'the network has it; a round or two and it is final. refresh in a few seconds.'
            : `${parsed ? shorten(parsed.key, 40) : (ref ?? []).join('/')} — nothing by that name on ${network}. she can look again, live.`}
        </p>
        <p>
          <a className="button button-primary" href="/">
            open the explorer →
          </a>
        </p>
      </main>
    )
  }
  const { card } = resolution
  const ask = `/?ask=${encodeURIComponent(`tell me about ${kind} ${parsed.key} on ${network}`)}`
  return (
    <main className="share-page">
      <p className="share-brand">
        ◆ QT314 <b>AGENT</b>
      </p>
      <h1 className="share-prompt">
        {titleOf(card)}
        <span className={`prompt-net net-${network}`}>{network}</span>
      </h1>
      <div className="note-agent share-note">
        <div className="note-agent-body">
          {factsOf(card).map(([label, value]) => (
            <p key={label} className="note-agent-text" style={{ overflowWrap: 'anywhere' }}>
              <span className="muted">{label} · </span>
              {value}
            </p>
          ))}
        </div>
      </div>
      <p className="share-ask">
        <a className="button button-primary" href={ask}>
          ask her about it →
        </a>
        <span className="muted">
          {' '}
          the question will be waiting in the composer; she answers live.
        </span>
      </p>
    </main>
  )
}

export async function entityImage(
  kind: EntityKind,
  ref: string[] | undefined,
  resolve: Resolver,
): Promise<ImageResponse> {
  const fonts = await ogFonts()
  const parsed = parseEntityRef(ref)
  if (!parsed)
    return new ImageResponse(
      <EntityOgMiss kind={kind} keyLabel={(ref ?? []).join('/')} network="mainnet" />,
      { ...OG_SIZE, fonts },
    )
  const resolution = await resolve(parsed.network, parsed.key)
  const headers = { 'cache-control': resolution.cacheControl }
  if (resolution.state === 'found')
    return new ImageResponse(<EntityOgCard card={resolution.card} />, {
      ...OG_SIZE,
      fonts,
      headers,
    })
  return new ImageResponse(
    <EntityOgMiss
      kind={kind}
      keyLabel={parsed.key}
      network={parsed.network}
      pending={resolution.state === 'pending'}
    />,
    { ...OG_SIZE, fonts, headers },
  )
}
