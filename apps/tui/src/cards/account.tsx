import {
  formatBaseUnits,
  formatMicroAlgos,
  type AccountPortfolioViewModel,
} from '@initlabs/vibekit-explorer'

import { COLORS, shorten } from '../theme.js'
import {
  Button,
  Fact,
  FooterNote,
  Frame,
  Header,
  Hero,
  Ident,
  innerWidth,
  Rule,
  Unavailable,
} from '../ui.js'
import { algo, MoreFooter, pad } from './shared.js'

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
  onCycleSort,
  onTransactions,
  onAssets,
}: {
  model: AccountPortfolioViewModel | undefined
  width: number
  sort?: AssetSort
  maxAssets?: number
  /** Cycles the holdings order; the button shows the current one. */
  onCycleSort?: () => void
  /** Opens this account's transaction list. */
  onTransactions?: () => void
  /** Opens every holding as its own paged list; the card shows the first few. */
  onAssets?: () => void
}) {
  if (!model) return <Unavailable title="ACCOUNT" width={width} />
  const body = innerWidth(width)
  const ordered = sortedAssets(model.assets, sort)
  const shown = ordered.slice(0, maxAssets)
  const idW = 12
  const amountW = Math.min(24, Math.max(12, Math.floor(body / 3)))
  const nameW = Math.max(8, body - amountW - idW - 3)
  const sortButton =
    onCycleSort && model.assets.length > 1 ? (
      <Button label={sort === 'none' ? 'sort ▾' : `sort ▾ ${ASSET_SORT_LABEL[sort]}`} onPress={onCycleSort} />
    ) : undefined
  return (
    <Frame width={width}>
      <Header
        kicker="ACCOUNT"
        pill={model.network.toUpperCase()}
        tone="idle"
        action={
          <>
            {onTransactions ? <Button label="transactions ▸" onPress={onTransactions} /> : null}
            {onAssets && model.assets.length > 0 ? <Button label="assets ▸" onPress={onAssets} /> : null}
            {sortButton}
          </>
        }
      />
      <Hero value={formatMicroAlgos(model.balanceMicroAlgos)} unit="ALGO" />
      <box marginTop={1} flexDirection="column">
        <Rule width={body} />
        <Fact label="address" value={model.address} copy={model.address} width={body} />
        <Fact label="holdings" value={String(model.totalAssets)} width={body} />
        {shown.length === 0 ? (
          <text fg={COLORS.faint} marginTop={1} content="no assets" />
        ) : (
          <box flexDirection="column" marginTop={1}>
            {/* One line per holding, like Lora's table: name · amount · id. The id still copies on click. */}
            <text fg={COLORS.faint} content={`${pad('name', nameW)} ${pad('amount', amountW, 'right')}  id`} />
            {shown.map((asset) => (
              <box key={String(asset.assetId)} flexDirection="row" height={1}>
                <text
                  fg={COLORS.text}
                  content={`${pad(asset.name ?? asset.unitName ?? `asset ${asset.assetId}`, nameW)} ${pad(
                    holdingAmount(asset.amount, asset.decimals, asset.unitName),
                    amountW,
                    'right',
                  )}${asset.isFrozen ? ' ❄' : ' '} `}
                />
                <Ident value={String(asset.assetId)} width={idW} />
              </box>
            ))}
          </box>
        )}
        {ordered.length > maxAssets ? (
          <FooterNote text={`${ordered.length - maxAssets} more${onAssets ? ' — assets ▸ lists them all' : ''}`} width={body} />
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
  name,
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
  name?: string
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
        {name ? <Fact label="name" value={name} width={body} /> : null}
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
  missing,
  width,
  onMore,
  loadingMore,
  onOpen,
}: {
  accounts: ReadonlyArray<{
    address: string
    name?: string
    balanceMicroAlgos: number | string
    status?: string
    minBalanceMicroAlgos?: number | string
    rekeyedTo?: string
  }>
  nextToken?: string
  missing?: ReadonlyArray<string>
  width: number
  onMore?: () => void
  loadingMore?: boolean
  onOpen?: (address: string) => void
}) {
  const body = innerWidth(width)
  const rows = accounts
  const missingNote =
    missing && missing.length > 0
      ? `${missing.length} not found on this network: ${missing.map((address) => shorten(address, 12)).join(', ')}`
      : undefined
  return (
    <Frame width={width}>
      <Header kicker="ACCOUNTS" pill={String(accounts.length)} tone="idle" />
      <box flexDirection="column">
        {rows.map((account, index) => (
          <box key={account.address} flexDirection="column" marginTop={1}>
            <box flexDirection="row" justifyContent="space-between" height={1}>
              <Fact label="name" value={account.name ?? '—'} width={body - 12} />
              {onOpen ? <Button label="open ▸" onPress={() => onOpen(account.address)} /> : null}
            </box>
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
        {accounts.length === 0 ? (
          <FooterNote text="No accounts found on this network." width={body} />
        ) : null}
        {missingNote ? <FooterNote text={missingNote} width={body} /> : null}
        <MoreFooter shown={rows.length} total={accounts.length} nextToken={nextToken} onMore={onMore} loadingMore={loadingMore} width={body} />
      </box>
    </Frame>
  )
}
