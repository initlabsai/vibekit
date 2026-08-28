'use client'

import { formatAssetAmount, formatBaseUnits, type AssetDetailViewModel } from '@initlabs/vibekit-explorer'

import { formatUsd, useAssetMeta } from '../../enrich'
import { MoreFooter, Table, type Column } from '../../generic-cards'
import { AssetMark, Button, Copyable, Fact, Facts, FooterNote, Frame, Header, Hero, TierBadge, Unavailable } from '../../primitives'
import { shorten } from '../../theme'

export function AssetCard({
  model,
  onTransactions,
}: {
  model: AssetDetailViewModel | undefined
  onTransactions?: () => void
}) {
  const meta = useAssetMeta(model?.assetId, true)
  if (!model) return <Unavailable title="ASSET" />
  const title = model.name ?? model.unitName ?? `Asset #${model.assetId}`
  const address = (label: string, value: string | undefined) =>
    value ? <Fact label={label} value={value} copy={value} /> : null
  const tone = meta?.tier === 'suspicious' ? 'danger' : meta?.tier === 'trusted' || meta?.tier === 'verified' ? 'ok' : 'idle'
  const project = meta?.project
  return (
    <Frame tone={meta?.tier === 'suspicious' ? 'danger' : undefined}>
      <Header
        kicker="ASSET"
        chip={model.unitName}
        pill={meta?.tier ? `PERA ${meta.tier}` : model.network.toUpperCase()}
        tone={tone}
        action={onTransactions ? <Button label="transactions ▸" onPress={onTransactions} /> : undefined}
      />
      <p className="hero">
        <span className="hero-value asset-hero">
          {meta?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="asset-logo asset-logo-lg" src={meta.logoUrl} alt="" width={40} height={40} />
          ) : null}
          {title}
          <TierBadge tier={meta?.tier} />
        </span>
        {meta?.priceUsd !== undefined ? <span className="hero-unit">{formatUsd(meta.priceUsd)}</span> : null}
      </p>
      <Facts>
        <Fact label="id" value={String(model.assetId)} copy={String(model.assetId)} />
        <Fact label="supply" value={`${formatBaseUnits(model.totalSupply, model.decimals)}${model.unitName ? ` ${model.unitName}` : ''}`} />
        <Fact label="decimals" value={String(model.decimals)} />
        {model.defaultFrozen === undefined ? null : <Fact label="frozen" value={model.defaultFrozen ? 'yes' : 'no'} />}
        {model.url ? <Fact label="url" value={model.url} /> : null}
        <Fact label="creator" value={model.creator ?? '—'} copy={model.creator} />
        {address('manager', model.manager)}
        {address('reserve', model.reserve)}
        {address('freeze', model.freeze)}
        {address('clawback', model.clawback)}
        {project?.name ? <Fact label="project" value={project.name} /> : null}
        {project?.url ? <Fact label="site"><a className="ident" href={project.url} target="_blank" rel="noreferrer">{project.url}</a></Fact> : null}
        {project?.twitter ? <Fact label="twitter" value={`@${project.twitter}`} copy={project.twitter} /> : null}
      </Facts>
      {project?.description ? <FooterNote text={project.description} /> : null}
      {meta?.tier === 'suspicious' ? <p className="flow-warning">Pera flags this asset as suspicious.</p> : null}
    </Frame>
  )
}

type AssetRow = {
  assetId: number | string
  name?: string
  unitName?: string
  totalSupply: string
  decimals: number
  creator?: string
}

export function AssetListCard({
  assets,
  nextToken,
  onMore,
  loadingMore,
  onOpen,
}: {
  assets: ReadonlyArray<AssetRow>
  nextToken?: string
  onMore?: () => void
  loadingMore?: boolean
  onOpen?: (assetId: number) => void
}) {
  const columns: Column<AssetRow>[] = [
    { key: 'id', label: 'id', width: 'minmax(6rem, .7fr)', sortValue: (a) => BigInt(a.assetId), cell: (a) => <span className="tt-kind">{String(a.assetId)}</span> },
    { key: 'name', label: 'name', sortValue: (a) => a.name ?? a.unitName ?? '', cell: (a) => <AssetMark assetId={a.assetId} name={a.name} unitName={a.unitName} /> },
    { key: 'unit', label: 'unit', width: 'minmax(4rem, .5fr)', cell: (a) => a.unitName ?? '' },
    {
      key: 'supply',
      label: 'supply',
      align: 'right',
      sortValue: (a) => BigInt(a.totalSupply),
      cell: (a) => formatBaseUnits(a.totalSupply, a.decimals),
    },
    { key: 'creator', label: 'creator', width: 'minmax(8rem, 1fr)', cell: (a) => (a.creator ? <Copyable value={a.creator} display={shorten(a.creator, 14)} /> : '') },
  ]
  return (
    <Frame>
      <Header kicker="ASSETS" pill={String(assets.length)} tone="idle" />
      {assets.length === 0 ? (
        <FooterNote text="No assets." />
      ) : (
        <Table
          columns={columns}
          rows={assets}
          keyOf={(a) => String(a.assetId)}
          searchText={(a) => `${a.assetId} ${a.name ?? ''} ${a.unitName ?? ''} ${a.creator ?? ''}`}
          onOpen={onOpen ? (a) => onOpen(Number(a.assetId)) : undefined}
        />
      )}
      <MoreFooter count={assets.length} nextToken={nextToken} onMore={onMore} loadingMore={loadingMore} />
    </Frame>
  )
}

type HoldingRow = {
  assetId: number | string
  amount: string
  isFrozen: boolean
  decimals?: number
  name?: string
  unitName?: string
}

export function AssetHoldingsCard({
  assets,
  nextToken,
  onMore,
  loadingMore,
  onOpen,
}: {
  assets: ReadonlyArray<HoldingRow>
  nextToken?: string
  onMore?: () => void
  loadingMore?: boolean
  onOpen?: (assetId: number) => void
}) {
  const columns: Column<HoldingRow>[] = [
    { key: 'id', label: 'id', width: 'minmax(6rem, .7fr)', sortValue: (a) => BigInt(a.assetId), cell: (a) => <span className="tt-kind">{String(a.assetId)}</span> },
    { key: 'name', label: 'name', sortValue: (a) => a.name ?? a.unitName ?? '', cell: (a) => <AssetMark assetId={a.assetId} name={a.name} unitName={a.unitName} /> },
    {
      key: 'amount',
      label: 'amount',
      align: 'right',
      sortValue: (a) => BigInt(a.amount),
      cell: (a) => `${formatAssetAmount(a.amount, a.decimals, a.unitName)}${a.isFrozen ? ' ❄' : ''}`,
    },
  ]
  return (
    <Frame>
      <Header kicker="ASSET HOLDINGS" pill={String(assets.length)} tone="idle" />
      {assets.length === 0 ? (
        <FooterNote text="No holdings." />
      ) : (
        <Table
          columns={columns}
          rows={assets}
          keyOf={(a) => String(a.assetId)}
          searchText={(a) => `${a.assetId} ${a.name ?? ''} ${a.unitName ?? ''}`}
          onOpen={onOpen ? (a) => onOpen(Number(a.assetId)) : undefined}
        />
      )}
      <MoreFooter count={assets.length} nextToken={nextToken} onMore={onMore} loadingMore={loadingMore} />
    </Frame>
  )
}

type HolderRow = { address: string; amount: string; isFrozen: boolean }

export function AssetHoldersCard({
  balances,
  decimals,
  nextToken,
  onMore,
  loadingMore,
  onOpen,
}: {
  balances: ReadonlyArray<HolderRow>
  decimals?: number
  nextToken?: string
  onMore?: () => void
  loadingMore?: boolean
  onOpen?: (address: string) => void
}) {
  const columns: Column<HolderRow>[] = [
    { key: 'address', label: 'address', width: 'minmax(10rem, 1.6fr)', cell: (h) => <Copyable value={h.address} display={shorten(h.address, 20)} /> },
    {
      key: 'amount',
      label: 'amount',
      align: 'right',
      sortValue: (h) => BigInt(h.amount),
      cell: (h) => `${formatAssetAmount(h.amount, decimals)}${h.isFrozen ? ' ❄' : ''}`,
    },
  ]
  return (
    <Frame>
      <Header kicker="HOLDERS" pill={String(balances.length)} tone="idle" />
      {balances.length === 0 ? (
        <FooterNote text="No holders." />
      ) : (
        <Table
          columns={columns}
          rows={balances}
          keyOf={(h) => h.address}
          searchText={(h) => h.address}
          onOpen={onOpen ? (h) => onOpen(h.address) : undefined}
        />
      )}
      <MoreFooter count={balances.length} nextToken={nextToken} onMore={onMore} loadingMore={loadingMore} />
    </Frame>
  )
}
