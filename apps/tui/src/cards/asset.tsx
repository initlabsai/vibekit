import {
  formatBaseUnits,
  type AssetDetailViewModel,
} from '@initlabs/vibekit-experience'

import {
  Fact,
  FooterNote,
  Frame,
  Header,
  Hero,
  innerWidth,
  Rule,
  Unavailable,
} from '../ui.js'
import { pageNotes } from './shared.js'

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no'
}

export function AssetCard({
  model,
  width,
}: {
  model: AssetDetailViewModel | undefined
  width: number
}) {
  if (!model) return <Unavailable title="ASSET" width={width} />
  const body = innerWidth(width)
  const title = model.name ?? model.unitName ?? `Asset #${model.assetId}`
  return (
    <Frame width={width}>
      <Header
        kicker="ASSET"
        chip={model.unitName}
        pill={model.network.toUpperCase()}
        tone="idle"
      />
      <Hero value={title} />
      <box marginTop={1} flexDirection="column">
        <Rule width={body} />
        <Fact
          label="id"
          value={String(model.assetId)}
          copy={String(model.assetId)}
          width={body}
        />
        <Fact
          label="supply"
          value={`${formatBaseUnits(model.totalSupply, model.decimals)}${model.unitName ? ` ${model.unitName}` : ''}`}
          width={body}
        />
        <Fact label="decimals" value={String(model.decimals)} width={body} />
        {model.defaultFrozen === undefined ? null : (
          <Fact label="frozen" value={yesNo(model.defaultFrozen)} width={body} />
        )}
        {model.url ? <Fact label="url" value={model.url} width={body} /> : null}
        <Fact
          label="creator"
          value={model.creator ?? '—'}
          copy={model.creator}
          width={body}
        />
        {model.manager ? (
          <Fact label="manager" value={model.manager} copy={model.manager} width={body} />
        ) : null}
        {model.reserve ? (
          <Fact label="reserve" value={model.reserve} copy={model.reserve} width={body} />
        ) : null}
        {model.freeze ? (
          <Fact label="freeze" value={model.freeze} copy={model.freeze} width={body} />
        ) : null}
        {model.clawback ? (
          <Fact label="clawback" value={model.clawback} copy={model.clawback} width={body} />
        ) : null}
      </box>
    </Frame>
  )
}

export function AssetListCard({
  assets,
  nextToken,
  width,
}: {
  assets: ReadonlyArray<{
    assetId: number | string
    name?: string
    unitName?: string
    totalSupply: string
    decimals: number
    creator?: string
  }>
  nextToken?: string
  width: number
}) {
  const body = innerWidth(width)
  const rows = assets.slice(0, 10)
  return (
    <Frame width={width}>
      <Header kicker="ASSETS" pill={String(assets.length)} tone="idle" />
      <box flexDirection="column">
        {rows.map((asset, index) => (
          <box key={String(asset.assetId)} flexDirection="column" marginTop={1}>
            <Fact
              label="id"
              value={String(asset.assetId)}
              copy={String(asset.assetId)}
              width={body}
            />
            {asset.name || asset.unitName ? (
              <Fact
                label="name"
                value={asset.name ?? asset.unitName ?? ''}
                width={body}
              />
            ) : null}
            {asset.unitName && asset.name ? (
              <Fact label="unit" value={asset.unitName} width={body} />
            ) : null}
            <Fact label="supply" value={asset.totalSupply} width={body} />
            <Fact label="decimals" value={String(asset.decimals)} width={body} />
            {asset.creator ? (
              <Fact label="creator" value={asset.creator} copy={asset.creator} width={body} />
            ) : null}
            {index < rows.length - 1 ? <Rule width={body} /> : null}
          </box>
        ))}
        {pageNotes(assets.length, rows.length, nextToken).map((note) => (
          <FooterNote key={note} text={note} width={body} />
        ))}
      </box>
    </Frame>
  )
}

export function AssetHoldingsCard({
  assets,
  nextToken,
  width,
}: {
  assets: ReadonlyArray<{
    assetId: number | string
    amount: string
    isFrozen: boolean
    name?: string
    unitName?: string
  }>
  nextToken?: string
  width: number
}) {
  const body = innerWidth(width)
  const rows = assets.slice(0, 10)
  return (
    <Frame width={width}>
      <Header kicker="ASSET HOLDINGS" pill={String(assets.length)} tone="idle" />
      <box flexDirection="column">
        {rows.map((asset, index) => (
          <box key={String(asset.assetId)} flexDirection="column" marginTop={1}>
            <Fact
              label="id"
              value={String(asset.assetId)}
              copy={String(asset.assetId)}
              width={body}
            />
            {asset.name || asset.unitName ? (
              <Fact
                label="name"
                value={asset.name ?? asset.unitName ?? ''}
                width={body}
              />
            ) : null}
            {asset.unitName && asset.name ? (
              <Fact label="unit" value={asset.unitName} width={body} />
            ) : null}
            <Fact label="amount" value={asset.amount} width={body} />
            {asset.isFrozen ? <Fact label="frozen" value="yes" width={body} /> : null}
            {index < rows.length - 1 ? <Rule width={body} /> : null}
          </box>
        ))}
        {pageNotes(assets.length, rows.length, nextToken).map((note) => (
          <FooterNote key={note} text={note} width={body} />
        ))}
      </box>
    </Frame>
  )
}

export function AssetHoldersCard({
  balances,
  nextToken,
  width,
}: {
  balances: ReadonlyArray<{ address: string; amount: string; isFrozen: boolean }>
  nextToken?: string
  width: number
}) {
  const body = innerWidth(width)
  const rows = balances.slice(0, 10)
  return (
    <Frame width={width}>
      <Header kicker="HOLDERS" pill={String(balances.length)} tone="idle" />
      <box flexDirection="column">
        {rows.map((holder, index) => (
          <box key={holder.address} flexDirection="column" marginTop={1}>
            <Fact label="address" value={holder.address} copy={holder.address} width={body} />
            <Fact label="amount" value={holder.amount} width={body} />
            {holder.isFrozen ? <Fact label="frozen" value="yes" width={body} /> : null}
            {index < rows.length - 1 ? <Rule width={body} /> : null}
          </box>
        ))}
        {pageNotes(balances.length, rows.length, nextToken).map((note) => (
          <FooterNote key={note} text={note} width={body} />
        ))}
      </box>
    </Frame>
  )
}
