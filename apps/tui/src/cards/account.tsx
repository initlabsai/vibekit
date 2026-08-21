import {
  formatBaseUnits,
  formatMicroAlgos,
  type AccountPortfolioViewModel,
} from '@initlabs/vibekit-experience'

import { COLORS } from '../theme.js'
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
import { algo, pageNotes } from './shared.js'

function holdingAmount(amount: number | string, decimals?: number, unitName?: string): string {
  const display = decimals === undefined ? String(amount) : formatBaseUnits(amount, decimals)
  return unitName ? `${display} ${unitName}` : display
}

/** How an account card's asset rows are ordered; cycled with the `s` key. */
export type AssetSort = 'none' | 'amount-desc' | 'amount-asc' | 'id-asc'

export const ASSET_SORT_LABEL: Record<AssetSort, string> = {
  none: '',
  'amount-desc': 'amount ↓',
  'amount-asc': 'amount ↑',
  'id-asc': 'asset id ↑',
}

export function nextAssetSort(sort: AssetSort): AssetSort {
  const cycle: AssetSort[] = ['none', 'amount-desc', 'amount-asc', 'id-asc']
  return cycle[(cycle.indexOf(sort) + 1) % cycle.length]!
}

function sortedAssets(assets: AccountPortfolioViewModel['assets'], sort: AssetSort) {
  if (sort === 'none') return assets
  const big = (value: number | string) => BigInt(value)
  const compare = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0)
  const copy = [...assets]
  if (sort === 'id-asc') copy.sort((a, b) => compare(big(a.assetId), big(b.assetId)))
  else {
    copy.sort((a, b) => {
      const ascending = compare(big(a.amount), big(b.amount))
      return sort === 'amount-asc' ? ascending : -ascending
    })
  }
  return copy
}

export function AccountCard({
  model,
  width,
  sort = 'none',
  maxAssets = 4,
}: {
  model: AccountPortfolioViewModel | undefined
  width: number
  sort?: AssetSort
  maxAssets?: number
}) {
  if (!model) return <Unavailable title="ACCOUNT" width={width} />
  const body = innerWidth(width)
  const ordered = sortedAssets(model.assets, sort)
  const shown = ordered.slice(0, maxAssets)
  return (
    <Frame width={width}>
      <Header kicker="ACCOUNT" pill={model.network.toUpperCase()} tone="idle" />
      <Hero value={formatMicroAlgos(model.balanceMicroAlgos)} unit="ALGO" />
      <box marginTop={1} flexDirection="column">
        <Rule width={body} />
        <Fact label="address" value={model.address} copy={model.address} width={body} />
        <Fact label="holdings" value={String(model.totalAssets)} width={body} />
        {shown.length === 0 ? (
          <text fg={COLORS.faint} marginTop={1} content="no assets" />
        ) : (
          shown.map((asset, index) => (
            <box key={String(asset.assetId)} flexDirection="column" marginTop={1}>
              <Fact
                label="id"
                value={String(asset.assetId)}
                copy={String(asset.assetId)}
                width={body}
              />
              <Fact
                label="name"
                value={asset.name ?? asset.unitName ?? `asset ${asset.assetId}`}
                width={body}
              />
              <Fact label="amount" value={holdingAmount(asset.amount, asset.decimals, asset.unitName)} width={body} />
              {asset.isFrozen ? <Fact label="frozen" value="yes" width={body} /> : null}
              {index < shown.length - 1 ? <Rule width={body} /> : null}
            </box>
          ))
        )}
        {ordered.length > maxAssets ? (
          <FooterNote text={`${ordered.length - maxAssets} more assets`} width={body} />
        ) : null}
        {sort === 'none' ? null : (
          <FooterNote text={`sorted by ${ASSET_SORT_LABEL[sort]}`} width={body} />
        )}
      </box>
    </Frame>
  )
}

export function AccountSummaryCard({
  address,
  network,
  status,
  balanceMicroAlgos,
  totalAssetsOptedIn,
  totalAppsOptedIn,
  totalCreatedAssets,
  totalCreatedApps,
  createdAtRound,
  minBalanceMicroAlgos,
  rekeyedTo,
  width,
}: {
  address: string
  network: string
  status?: string
  balanceMicroAlgos: number | string
  totalAssetsOptedIn?: number
  totalAppsOptedIn?: number
  totalCreatedAssets?: number
  totalCreatedApps?: number
  createdAtRound?: number
  minBalanceMicroAlgos?: number | string
  rekeyedTo?: string
  width: number
}) {
  const body = innerWidth(width)
  const online = status?.toLowerCase() === 'online'
  return (
    <Frame width={width}>
      <Header
        kicker="ACCOUNT"
        pill={(status ?? network).toUpperCase()}
        tone={online ? 'ok' : 'idle'}
      />
      <Hero value={formatMicroAlgos(balanceMicroAlgos)} unit="ALGO" />
      <box marginTop={1} flexDirection="column">
        <Rule width={body} />
        <Fact label="address" value={address} copy={address} width={body} />
        {minBalanceMicroAlgos === undefined ? null : (
          <Fact label="min bal" value={algo(minBalanceMicroAlgos) ?? '—'} width={body} />
        )}
        {rekeyedTo ? (
          <Fact label="rekeyed" value={rekeyedTo} copy={rekeyedTo} width={body} />
        ) : null}
        <Fact
          label="opted"
          value={`${totalAssetsOptedIn ?? 0} asa · ${totalAppsOptedIn ?? 0} apps`}
          width={body}
        />
        <Fact
          label="created"
          value={`${totalCreatedAssets ?? 0} asa · ${totalCreatedApps ?? 0} apps`}
          width={body}
        />
        {createdAtRound === undefined ? null : (
          <Fact
            label="since"
            value={`round ${createdAtRound}`}
            copy={String(createdAtRound)}
            width={body}
          />
        )}
      </box>
    </Frame>
  )
}

export function AccountListCard({
  accounts,
  nextToken,
  width,
}: {
  accounts: ReadonlyArray<{
    address: string
    balanceMicroAlgos: number | string
    status?: string
    minBalanceMicroAlgos?: number | string
    rekeyedTo?: string
  }>
  nextToken?: string
  width: number
}) {
  const body = innerWidth(width)
  const rows = accounts.slice(0, 10)
  return (
    <Frame width={width}>
      <Header kicker="ACCOUNTS" pill={String(accounts.length)} tone="idle" />
      <box flexDirection="column">
        {rows.map((account, index) => (
          <box key={account.address} flexDirection="column" marginTop={1}>
            <Fact label="address" value={account.address} copy={account.address} width={body} />
            <Fact label="balance" value={algo(account.balanceMicroAlgos) ?? '—'} width={body} />
            {account.status ? <Fact label="status" value={account.status} width={body} /> : null}
            {account.minBalanceMicroAlgos === undefined ? null : (
              <Fact label="min bal" value={algo(account.minBalanceMicroAlgos) ?? '—'} width={body} />
            )}
            {account.rekeyedTo ? (
              <Fact label="rekeyed" value={account.rekeyedTo} copy={account.rekeyedTo} width={body} />
            ) : null}
            {index < rows.length - 1 ? <Rule width={body} /> : null}
          </box>
        ))}
        {pageNotes(accounts.length, rows.length, nextToken).map((note) => (
          <FooterNote key={note} text={note} width={body} />
        ))}
      </box>
    </Frame>
  )
}
