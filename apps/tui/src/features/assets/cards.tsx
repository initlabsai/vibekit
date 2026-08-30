import { formatAssetAmount, formatBaseUnits, type AssetDetailViewModel } from '@initlabs/vibekit/views'

import {
  Button,
  Fact,
  FooterNote,
  Frame,
  Header,
  Hero,
  innerWidth,
  Rule,
  Unavailable,
} from '../../primitives.js'
import { ListCard } from '../../generic-cards.js'

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no'
}

export function AssetCard({
  model,
  width,
  onTransactions,
}: {
  model: AssetDetailViewModel | undefined
  width: number
  onTransactions?: () => void
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
        action={
          onTransactions ? <Button label="transactions ▸" onPress={onTransactions} /> : undefined
        }
      />
      <Hero value={title} />
      <box marginTop={1} flexDirection="column">
        <Rule width={body} />
        <Fact label="id" value={String(model.assetId)} copy={String(model.assetId)} width={body} />
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
        <Fact label="creator" value={model.creator ?? '—'} copy={model.creator} width={body} />
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
  onMore,
  loadingMore,
  onOpen,
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
  /** Fetches the next page into this card; present only when the record can. */
  onMore?: () => void
  loadingMore?: boolean
  onOpen?: (assetId: number) => void
}) {
  return (
    <ListCard
      kicker="ASSETS"
      pill={String(assets.length)}
      rows={assets}
      keyOf={(asset) => String(asset.assetId)}
      lead={(asset) => ({ label: 'id', value: String(asset.assetId), copy: String(asset.assetId) })}
      onOpen={onOpen && ((asset) => onOpen(Number(asset.assetId)))}
      facts={(asset, body) => (
        <>
          {asset.name || asset.unitName ? (
            <Fact label="name" value={asset.name ?? asset.unitName ?? ''} width={body} />
          ) : null}
          {asset.unitName && asset.name ? (
            <Fact label="unit" value={asset.unitName} width={body} />
          ) : null}
          <Fact label="supply" value={asset.totalSupply} width={body} />
          <Fact label="decimals" value={String(asset.decimals)} width={body} />
          {asset.creator ? (
            <Fact label="creator" value={asset.creator} copy={asset.creator} width={body} />
          ) : null}
        </>
      )}
      nextToken={nextToken}
      onMore={onMore}
      loadingMore={loadingMore}
      width={width}
    />
  )
}

export function AssetHoldingsCard({
  assets,
  nextToken,
  width,
  onMore,
  loadingMore,
  onOpen,
}: {
  assets: ReadonlyArray<{
    assetId: number | string
    amount: string
    isFrozen: boolean
    decimals?: number
    name?: string
    unitName?: string
  }>
  nextToken?: string
  width: number
  /** Fetches the next page into this card; present only when the record can. */
  onMore?: () => void
  loadingMore?: boolean
  onOpen?: (assetId: number) => void
}) {
  return (
    <ListCard
      kicker="ASSET HOLDINGS"
      pill={String(assets.length)}
      rows={assets}
      keyOf={(asset) => String(asset.assetId)}
      lead={(asset) => ({ label: 'id', value: String(asset.assetId), copy: String(asset.assetId) })}
      onOpen={onOpen && ((asset) => onOpen(Number(asset.assetId)))}
      facts={(asset, body) => (
        <>
          {asset.name || asset.unitName ? (
            <Fact label="name" value={asset.name ?? asset.unitName ?? ''} width={body} />
          ) : null}
          {asset.unitName && asset.name ? (
            <Fact label="unit" value={asset.unitName} width={body} />
          ) : null}
          <Fact
            label="amount"
            value={formatAssetAmount(asset.amount, asset.decimals)}
            width={body}
          />
          {asset.isFrozen ? <Fact label="frozen" value="yes" width={body} /> : null}
        </>
      )}
      nextToken={nextToken}
      onMore={onMore}
      loadingMore={loadingMore}
      width={width}
    />
  )
}

export function AssetHoldersCard({
  balances,
  decimals,
  nextToken,
  width,
  onMore,
  loadingMore,
}: {
  balances: ReadonlyArray<{ address: string; amount: string; isFrozen: boolean }>
  decimals?: number
  nextToken?: string
  width: number
  /** Fetches the next page into this card; present only when the record can. */
  onMore?: () => void
  loadingMore?: boolean
}) {
  return (
    <ListCard
      kicker="HOLDERS"
      pill={String(balances.length)}
      rows={balances}
      keyOf={(holder) => holder.address}
      facts={(holder, body) => (
        <>
          <Fact label="address" value={holder.address} copy={holder.address} width={body} />
          <Fact label="amount" value={formatAssetAmount(holder.amount, decimals)} width={body} />
          {holder.isFrozen ? <Fact label="frozen" value="yes" width={body} /> : null}
        </>
      )}
      nextToken={nextToken}
      onMore={onMore}
      loadingMore={loadingMore}
      width={width}
    />
  )
}
