'use client'

import {
  formatAssetAmount,
  formatMicroAlgos,
  type AccountPortfolioViewModel,
  type AccountSummaryViewModel,
} from '@initlabs/vibekit-explorer'

import { formatUsd, useAlgoPrice, useAssetMeta } from '../../enrich'
import { algo, MoreFooter, Table, type Column } from '../../generic-cards'
import { AssetMark, Identity } from '../../primitives'
import { Button, Copyable, Fact, Facts, FooterNote, Frame, Header, Hero, Unavailable } from '../../primitives'
import { shorten } from '../../theme'

type Holding = AccountPortfolioViewModel['assets'][number]

/** Base units × decimals × USD price, when Pera or Vestige price the asset. */
function HoldingUsd({ asset }: { asset: Holding }) {
  const meta = useAssetMeta(asset.assetId)
  if (meta?.priceUsd === undefined) return <span className="faint">—</span>
  const units = Number(asset.amount) / 10 ** (asset.decimals ?? 0)
  return <>{formatUsd(units * meta.priceUsd)}</>
}

export function AccountCard({
  model,
  onTransactions,
  onAssets,
  onOpenAsset,
}: {
  model: AccountPortfolioViewModel | undefined
  onTransactions?: () => void
  onAssets?: () => void
  onOpenAsset?: (assetId: number) => void
}) {
  const algoPrice = useAlgoPrice()
  if (!model) return <Unavailable title="ACCOUNT" />
  const algoUsd = algoPrice === undefined ? undefined : (Number(model.balanceMicroAlgos) / 1e6) * algoPrice
  const columns: Column<Holding>[] = [
    {
      key: 'name',
      label: 'name',
      sortValue: (asset) => asset.name ?? asset.unitName ?? `asset ${asset.assetId}`,
      cell: (asset) => <AssetMark assetId={asset.assetId} name={asset.name} unitName={asset.unitName} />,
    },
    {
      key: 'amount',
      label: 'amount',
      align: 'right',
      sortValue: (asset) => BigInt(asset.amount),
      cell: (asset) => `${formatAssetAmount(asset.amount, asset.decimals, asset.unitName)}${asset.isFrozen ? ' ❄' : ''}`,
    },
    { key: 'usd', label: 'usd', align: 'right', width: 'minmax(5rem, .6fr)', cell: (asset) => <HoldingUsd asset={asset} /> },
    {
      key: 'id',
      label: 'id',
      align: 'right',
      width: 'minmax(6rem, .6fr)',
      sortValue: (asset) => BigInt(asset.assetId),
      cell: (asset) => <Copyable value={String(asset.assetId)} />,
    },
  ]
  return (
    <Frame>
      <Header
        kicker="ACCOUNT"
        pill={model.network.toUpperCase()}
        tone="idle"
        action={
          <>
            {onTransactions ? <Button label="transactions ▸" onPress={onTransactions} /> : null}
            {onAssets && model.assets.length > 0 ? <Button label="assets ▸" onPress={onAssets} /> : null}
          </>
        }
      />
      <div className="identity-row">
        <Identity address={model.address} />
      </div>
      <Hero value={formatMicroAlgos(model.balanceMicroAlgos)} unit={algoUsd === undefined ? 'ALGO' : `ALGO · ≈ ${formatUsd(algoUsd)}`} />
      <Facts>
        <Fact label="holdings" value={String(model.totalAssets)} />
      </Facts>
      {model.assets.length === 0 ? (
        <FooterNote text="no assets" />
      ) : (
        <Table
          columns={columns}
          rows={model.assets}
          keyOf={(asset) => String(asset.assetId)}
          searchText={(asset) => `${asset.name ?? ''} ${asset.unitName ?? ''} ${asset.assetId}`}
          onOpen={onOpenAsset ? (asset) => onOpenAsset(Number(asset.assetId)) : undefined}
        />
      )}
      {model.totalAssets > model.assets.length ? (
        <FooterNote text={`${model.totalAssets - model.assets.length} more${onAssets ? ' — assets ▸ lists them all' : ''}`} />
      ) : null}
    </Frame>
  )
}

export function AccountSummaryCard({ model }: { model: AccountSummaryViewModel }) {
  const online = model.status?.toLowerCase() === 'online'
  return (
    <Frame>
      <Header kicker="ACCOUNT" pill={(model.status ?? model.network).toUpperCase()} tone={online ? 'ok' : 'idle'} />
      <Hero value={formatMicroAlgos(model.balanceMicroAlgos)} unit="ALGO" />
      <Facts>
        {model.name ? <Fact label="name" value={model.name} /> : null}
        <Fact label="address" value={model.address} copy={model.address} />
        {model.minBalanceMicroAlgos === undefined ? null : <Fact label="min bal" value={algo(model.minBalanceMicroAlgos)} />}
        {model.rekeyedTo ? <Fact label="rekeyed" value={model.rekeyedTo} copy={model.rekeyedTo} /> : null}
        <Fact label="opted" value={`${model.totalAssetsOptedIn ?? 0} asa · ${model.totalAppsOptedIn ?? 0} apps`} />
        <Fact label="created" value={`${model.totalCreatedAssets ?? 0} asa · ${model.totalCreatedApps ?? 0} apps`} />
        {model.createdAtRound === undefined ? null : (
          <Fact label="since" value={`round ${model.createdAtRound}`} copy={String(model.createdAtRound)} />
        )}
      </Facts>
    </Frame>
  )
}

type AccountRow = {
  address: string
  name?: string
  balanceMicroAlgos: number | string
  status?: string
  minBalanceMicroAlgos?: number | string
  rekeyedTo?: string
}

export function AccountListCard({
  accounts,
  nextToken,
  missing,
  onMore,
  loadingMore,
  onOpen,
}: {
  accounts: ReadonlyArray<AccountRow>
  nextToken?: string
  missing?: ReadonlyArray<string>
  onMore?: () => void
  loadingMore?: boolean
  onOpen?: (address: string) => void
}) {
  const columns: Column<AccountRow>[] = [
    { key: 'name', label: 'name', width: 'minmax(5rem, .7fr)', sortValue: (a) => a.name ?? '', cell: (a) => a.name ?? '—' },
    {
      key: 'address',
      label: 'address',
      width: 'minmax(10rem, 1.6fr)',
      cell: (a) => <Copyable value={a.address} display={shorten(a.address, 20)} />,
    },
    {
      key: 'balance',
      label: 'balance',
      align: 'right',
      sortValue: (a) => BigInt(a.balanceMicroAlgos),
      cell: (a) => algo(a.balanceMicroAlgos),
    },
    { key: 'status', label: 'status', width: 'minmax(4rem, .5fr)', sortValue: (a) => a.status ?? '', cell: (a) => a.status ?? '' },
  ]
  return (
    <Frame>
      <Header kicker="ACCOUNTS" pill={String(accounts.length)} tone="idle" />
      {accounts.length === 0 ? (
        <FooterNote text="No accounts found on this network." />
      ) : (
        <Table
          columns={columns}
          rows={accounts}
          keyOf={(a) => a.address}
          searchText={(a) => `${a.name ?? ''} ${a.address} ${a.status ?? ''}`}
          onOpen={onOpen ? (a) => onOpen(a.address) : undefined}
        />
      )}
      {missing && missing.length > 0 ? (
        <FooterNote text={`${missing.length} not found on this network: ${missing.map((address) => shorten(address, 12)).join(', ')}`} />
      ) : null}
      <MoreFooter count={accounts.length} nextToken={nextToken} onMore={onMore} loadingMore={loadingMore} />
    </Frame>
  )
}
