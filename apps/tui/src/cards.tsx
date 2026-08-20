import {
  formatBaseUnits,
  formatBlockTxnType,
  formatExplorerTime,
  formatMicroAlgos,
  formatOnCompletion,
  type AccountPortfolioViewModel,
  type ApplicationDetailViewModel,
  type AssetDetailViewModel,
  type BlockDetailViewModel,
  type NetworkStatusViewModel,
  type PaymentFlowViewModel,
  type TransactionDetailViewModel,
} from '@initlabs/vibekit-experience'

import { COLORS, shorten } from './theme.js'
import {
  Card,
  Chip,
  Fact,
  FooterNote,
  Frame,
  Header,
  Hero,
  innerWidth,
  PartyPath,
  Rule,
  StatGrid,
  Unavailable,
  type Tone,
} from './ui.js'

export { Card, Unavailable }

function algo(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined
  return `${formatMicroAlgos(value)} ALGO`
}

function pageNotes(total: number, shown: number, nextToken?: string): string[] {
  const notes: string[] = []
  if (total > shown) notes.push(`${total - shown} more`)
  if (nextToken) notes.push('more pages available')
  return notes
}

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no'
}

function holdingAmount(amount: number | string, unitName?: string): string {
  return unitName ? `${amount} ${unitName}` : String(amount)
}

function assetUnits(
  amount: number | string | undefined,
  decimals?: number,
  unitName?: string,
): { value: string; unit?: string } | undefined {
  if (amount === undefined) return undefined
  const value = decimals === undefined ? String(amount) : formatBaseUnits(amount, decimals)
  return { value, unit: unitName }
}

export function TransactionCard({
  model,
  width,
}: {
  model: TransactionDetailViewModel | undefined
  width: number
}) {
  if (!model) return <Unavailable title="TRANSACTION" width={width} />
  const body = innerWidth(width)
  const payment = model.amountMicroAlgos === undefined
    ? undefined
    : { value: formatMicroAlgos(model.amountMicroAlgos), unit: 'ALGO' }
  const transfer = assetUnits(model.assetAmount, model.assetDecimals, model.assetUnitName)
  const hero = payment ?? transfer
  const tone: Tone = model.status === 'confirmed' ? 'ok' : model.status === 'failed' ? 'bad' : 'warn'
  const assetLabel =
    model.assetId === undefined
      ? undefined
      : model.assetName
        ? `${model.assetId} · ${model.assetName}`
        : String(model.assetId)
  return (
    <Frame width={width}>
      <Header
        kicker="TRANSACTION"
        chip={formatBlockTxnType(model.type)}
        pill={model.status.toUpperCase()}
        tone={tone}
      />
      {hero ? <Hero value={hero.value} unit={hero.unit} /> : null}
      <box marginTop={1} flexDirection="column">
        <Rule width={body} />
        <Fact label="id" value={model.id} copy={model.id} width={body} />
        {model.roundTime === undefined ? null : (
          <Fact label="time" value={formatExplorerTime(model.roundTime)} width={body} />
        )}
        {model.confirmedRound === undefined ? null : (
          <Fact
            label="block"
            value={String(model.confirmedRound)}
            copy={String(model.confirmedRound)}
            width={body}
          />
        )}
        <Fact label="fee" value={algo(model.feeMicroAlgos) ?? '—'} width={body} />
        <Fact label="from" value={model.sender} copy={model.sender} width={body} />
        {model.clawbackFrom ? (
          <Fact label="clawback" value={model.clawbackFrom} copy={model.clawbackFrom} width={body} />
        ) : null}
        {model.receiver ? (
          <Fact label="to" value={model.receiver} copy={model.receiver} width={body} />
        ) : null}
        {assetLabel && model.assetId !== undefined ? (
          <Fact label="asset" value={assetLabel} copy={String(model.assetId)} width={body} />
        ) : null}
        {model.applicationId === undefined ? null : (
          <Fact
            label="app"
            value={String(model.applicationId)}
            copy={String(model.applicationId)}
            width={body}
          />
        )}
        {model.onCompletion ? (
          <Fact label="on-comp" value={formatOnCompletion(model.onCompletion)} width={body} />
        ) : null}
        {model.closeTo ? (
          <Fact label="close" value={model.closeTo} copy={model.closeTo} width={body} />
        ) : null}
        {model.closeAmountMicroAlgos === undefined ? null : (
          <Fact label="closed" value={algo(model.closeAmountMicroAlgos) ?? '—'} width={body} />
        )}
        {model.closeAssetAmount === undefined ? null : (
          <Fact
            label="closed"
            value={
              assetUnits(model.closeAssetAmount, model.assetDecimals, model.assetUnitName)?.value ??
              String(model.closeAssetAmount)
            }
            width={body}
          />
        )}
        {model.rekeyTo ? (
          <Fact label="rekey" value={model.rekeyTo} copy={model.rekeyTo} width={body} />
        ) : null}
        {model.group ? (
          <Fact label="group" value={model.group} copy={model.group} width={body} />
        ) : null}
        {model.innerCount ? <Fact label="inner" value={`+${model.innerCount}`} width={body} /> : null}
        {model.note ? <Fact label="note" value={model.note} width={body} /> : null}
        <Fact label="network" value={model.network} width={body} />
      </box>
    </Frame>
  )
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
              <Fact label="amount" value={holdingAmount(asset.amount, asset.unitName)} width={body} />
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

export function ApplicationCard({
  model,
  width,
}: {
  model: ApplicationDetailViewModel | undefined
  width: number
}) {
  if (!model) return <Unavailable title="APPLICATION" width={width} />
  const body = innerWidth(width)
  const global = model.globalStateSchema
  const local = model.localStateSchema
  return (
    <Frame width={width}>
      <Header kicker="APPLICATION" pill={model.network.toUpperCase()} tone="idle" />
      <Hero value={`#${model.applicationId}`} copy={String(model.applicationId)} />
      <box marginTop={1} flexDirection="column">
        <Rule width={body} />
        <Fact
          label="creator"
          value={model.creator ?? '—'}
          copy={model.creator}
          width={body}
        />
        {model.account ? (
          <Fact label="account" value={model.account} copy={model.account} width={body} />
        ) : null}
        <Fact
          label="keys"
          value={`${model.globalStateCount} key${model.globalStateCount === 1 ? '' : 's'}`}
          width={body}
        />
        {global ? <Fact label="g-bytes" value={String(global.numByteSlice)} width={body} /> : null}
        {global ? <Fact label="g-uint" value={String(global.numUint)} width={body} /> : null}
        {local ? <Fact label="l-bytes" value={String(local.numByteSlice)} width={body} /> : null}
        {local ? <Fact label="l-uint" value={String(local.numUint)} width={body} /> : null}
      </box>
    </Frame>
  )
}

export function BlockCard({
  model,
  width,
}: {
  model: BlockDetailViewModel | undefined
  width: number
}) {
  if (!model) return <Unavailable title="BLOCK" width={width} />
  const body = innerWidth(width)
  return (
    <Frame width={width}>
      <Header kicker="BLOCK" pill={model.network.toUpperCase()} tone="idle" />
      <Hero value={String(model.round)} unit="round" copy={String(model.round)} />
      <box marginTop={1} flexDirection="column">
        <Rule width={body} />
        <Fact label="time" value={formatExplorerTime(model.timestamp)} width={body} />
        <box flexDirection="row" height={1}>
          <text fg={COLORS.faint} content={'txns'.padEnd(10)} />
          {model.transactionTypes.length === 0 ? (
            <text fg={COLORS.text}>{String(model.transactionCount)}</text>
          ) : (
            <box flexDirection="row">
              {model.transactionTypes.map((entry, index) => (
                <box key={entry.type} flexDirection="row">
                  {index > 0 ? <text fg={COLORS.panel}> </text> : null}
                  <Chip
                    label={
                      entry.count === 1
                        ? formatBlockTxnType(entry.type)
                        : `${formatBlockTxnType(entry.type)} ${entry.count}`
                    }
                  />
                </box>
              ))}
              <text fg={COLORS.muted}>{`  ${model.transactionCount} total`}</text>
            </box>
          )}
        </box>
        <Fact
          label="proposer"
          value={model.proposer ?? '—'}
          copy={model.proposer}
          width={body}
        />
        <Fact
          label="fees"
          value={
            model.feesCollectedMicroAlgos === undefined
              ? '—'
              : (algo(model.feesCollectedMicroAlgos) ?? '—')
          }
          width={body}
        />
        {model.proposerPayoutMicroAlgos === undefined ? null : (
          <Fact label="payout" value={algo(model.proposerPayoutMicroAlgos) ?? '—'} width={body} />
        )}
        {model.previousRound === undefined ? null : (
          <Fact
            label="prev"
            value={String(model.previousRound)}
            copy={String(model.previousRound)}
            width={body}
          />
        )}
        {model.nextRound === undefined ? null : (
          <Fact
            label="next"
            value={String(model.nextRound)}
            copy={String(model.nextRound)}
            width={body}
          />
        )}
      </box>
    </Frame>
  )
}

export function NetworkCard({
  model,
  width,
}: {
  model: NetworkStatusViewModel | undefined
  width: number
}) {
  if (!model) return <Unavailable title="NETWORK" width={width} />
  const body = innerWidth(width)
  const stats = [
    {
      label: 'round',
      value: String(model.latestRound),
      copy: String(model.latestRound),
    },
    { label: 'block', value: `${model.avgBlockTime}s` },
    { label: 'online', value: String(model.participation) },
  ]
  return (
    <Frame width={width}>
      <Header kicker="NETWORK" pill={model.network.toUpperCase()} tone="idle" />
      <Hero value={String(model.avgTps)} unit="TPS" />
      <StatGrid items={stats} width={body} />
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

export function TransactionListCard({
  title,
  groupId,
  transactions,
  nextToken,
  width,
}: {
  title: string
  groupId?: string
  transactions: ReadonlyArray<{
    id?: string
    type?: string
    sender: string
    receiver?: string
    paymentAmountMicroAlgos?: number | string
    feeMicroAlgos?: number | string
    assetId?: number | string
    assetAmount?: number | string
    applicationId?: number | string
    confirmedRound?: number
    roundTime?: number
    innerCount?: number
  }>
  nextToken?: string
  width: number
}) {
  const body = innerWidth(width)
  const rows = transactions.slice(0, 10)
  return (
    <Frame width={width}>
      <Header kicker={title} pill={String(transactions.length)} tone="idle" />
      {groupId ? <Fact label="group" value={groupId} copy={groupId} width={body} /> : null}
      <box flexDirection="column">
        {rows.map((row, index) => {
          const payment = algo(row.paymentAmountMicroAlgos)
          const asset =
            row.assetAmount === undefined
              ? undefined
              : `${row.assetAmount}${row.assetId === undefined ? '' : ` #${row.assetId}`}`
          const amount = payment ?? asset
          const to =
            row.receiver ??
            (row.applicationId === undefined ? undefined : `app ${row.applicationId}`)
          return (
            <box key={row.id ?? `${row.sender}-${index}`} flexDirection="column" marginTop={1}>
              <box flexDirection="row" height={1}>
                <Chip label={formatBlockTxnType(row.type ?? 'txn')} />
                {amount ? <text fg={COLORS.brassBright}>{`  ${amount}`}</text> : null}
              </box>
              <Fact label="from" value={row.sender} copy={row.sender} width={body} />
              {to ? (
                <Fact
                  label="to"
                  value={to}
                  copy={row.receiver ?? (row.applicationId === undefined ? undefined : String(row.applicationId))}
                  width={body}
                />
              ) : null}
              {row.id ? <Fact label="id" value={row.id} copy={row.id} width={body} /> : null}
              {row.confirmedRound === undefined ? null : (
                <Fact
                  label="round"
                  value={String(row.confirmedRound)}
                  copy={String(row.confirmedRound)}
                  width={body}
                />
              )}
              {row.roundTime === undefined ? null : (
                <Fact label="time" value={formatExplorerTime(row.roundTime)} width={body} />
              )}
              {row.feeMicroAlgos === undefined ? null : (
                <Fact label="fee" value={algo(row.feeMicroAlgos) ?? '—'} width={body} />
              )}
              {row.innerCount ? (
                <Fact label="inner" value={`+${row.innerCount}`} width={body} />
              ) : null}
              {index < rows.length - 1 ? <Rule width={body} /> : null}
            </box>
          )
        })}
        {pageNotes(transactions.length, rows.length, nextToken).map((note) => (
          <FooterNote key={note} text={note} width={body} />
        ))}
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

export function ApplicationListCard({
  applications,
  nextToken,
  width,
}: {
  applications: ReadonlyArray<{
    applicationId: number | string
    creator?: string
    globalStateCount?: number
  }>
  nextToken?: string
  width: number
}) {
  const body = innerWidth(width)
  const rows = applications.slice(0, 10)
  return (
    <Frame width={width}>
      <Header kicker="APPLICATIONS" pill={String(applications.length)} tone="idle" />
      <box flexDirection="column">
        {rows.map((application, index) => (
          <box key={String(application.applicationId)} flexDirection="column" marginTop={1}>
            <Fact
              label="id"
              value={String(application.applicationId)}
              copy={String(application.applicationId)}
              width={body}
            />
            {application.creator ? (
              <Fact
                label="creator"
                value={application.creator}
                copy={application.creator}
                width={body}
              />
            ) : null}
            <Fact
              label="keys"
              value={`${application.globalStateCount ?? 0} key${(application.globalStateCount ?? 0) === 1 ? '' : 's'}`}
              width={body}
            />
            {index < rows.length - 1 ? <Rule width={body} /> : null}
          </box>
        ))}
        {pageNotes(applications.length, rows.length, nextToken).map((note) => (
          <FooterNote key={note} text={note} width={body} />
        ))}
      </box>
    </Frame>
  )
}

export function ApplicationStateCard({
  applicationId,
  scope,
  address,
  optedIn,
  entries,
  width,
}: {
  applicationId: number | string
  scope: 'global' | 'local'
  address?: string
  optedIn?: boolean
  entries: ReadonlyArray<{ key: string; value: string; type?: string }>
  width: number
}) {
  const body = innerWidth(width)
  return (
    <Frame width={width}>
      <Header kicker="APP STATE" pill={scope.toUpperCase()} tone="idle" />
      <Fact
        label="app"
        value={String(applicationId)}
        copy={String(applicationId)}
        width={body}
      />
      {address ? (
        <Fact label="address" value={address} copy={address} width={body} />
      ) : null}
      {optedIn === undefined ? null : (
        <Fact label="opted" value={optedIn ? 'yes' : 'no'} width={body} />
      )}
      <box marginTop={1} flexDirection="column">
        <Fact
          label="keys"
          value={`${entries.length} key${entries.length === 1 ? '' : 's'}`}
          width={body}
        />
        {entries.slice(0, 6).map((entry) => (
          <Fact
            key={entry.key}
            label={shorten(entry.key, 9)}
            value={entry.type ? `${entry.type} · ${entry.value}` : entry.value}
            width={body}
          />
        ))}
        {entries.length > 6 ? (
          <FooterNote text={`${entries.length - 6} more keys`} width={body} />
        ) : null}
      </box>
    </Frame>
  )
}

export function ApplicationLocalsCard({
  address,
  apps,
  nextToken,
  width,
}: {
  address?: string
  apps: ReadonlyArray<{
    applicationId: number | string
    entries: ReadonlyArray<{ key: string; value: string; type?: string }>
  }>
  nextToken?: string
  width: number
}) {
  const body = innerWidth(width)
  const shown = apps.slice(0, 6)
  return (
    <Frame width={width}>
      <Header kicker="APP LOCALS" pill={String(apps.length)} tone="idle" />
      {address ? (
        <Fact label="address" value={address} copy={address} width={body} />
      ) : null}
      <box marginTop={1} flexDirection="column">
        {shown.map((app) => (
          <box key={String(app.applicationId)} flexDirection="column" marginTop={1}>
            <Fact
              label="app"
              value={String(app.applicationId)}
              copy={String(app.applicationId)}
              width={body}
            />
            <Fact
              label="keys"
              value={`${app.entries.length} key${app.entries.length === 1 ? '' : 's'}`}
              width={body}
            />
            {app.entries.slice(0, 6).map((entry) => (
              <Fact
                key={entry.key}
                label={shorten(entry.key, 9)}
                value={entry.type ? `${entry.type} · ${entry.value}` : entry.value}
                width={body}
              />
            ))}
            {app.entries.length > 6 ? (
              <FooterNote text={`${app.entries.length - 6} more keys`} width={body} />
            ) : null}
          </box>
        ))}
        {apps.length > 6 ? <FooterNote text={`${apps.length - 6} more apps`} width={body} /> : null}
        {nextToken ? <FooterNote text="more pages available" width={body} /> : null}
      </box>
    </Frame>
  )
}

export function ApplicationLogsCard({
  applicationId,
  logData,
  nextToken,
  width,
}: {
  applicationId: number | string
  logData: ReadonlyArray<{ txid: string; logs: string[] }>
  nextToken?: string
  width: number
}) {
  const body = innerWidth(width)
  const rows = logData.slice(0, 10)
  return (
    <Frame width={width}>
      <Header kicker="APP LOGS" pill={String(applicationId)} tone="idle" />
      <box flexDirection="column">
        {rows.map((row, index) => (
          <box key={row.txid} flexDirection="column" marginTop={1}>
            <Fact label="id" value={row.txid} copy={row.txid} width={body} />
            <Fact
              label="logs"
              value={`${row.logs.length} log${row.logs.length === 1 ? '' : 's'}`}
              width={body}
            />
            {row.logs.slice(0, 3).map((line, logIndex) => (
              <Fact key={`${row.txid}-${logIndex}`} label="log" value={line} width={body} />
            ))}
            {row.logs.length > 3 ? (
              <FooterNote text={`${row.logs.length - 3} more logs`} width={body} />
            ) : null}
            {index < rows.length - 1 ? <Rule width={body} /> : null}
          </box>
        ))}
        {pageNotes(logData.length, rows.length, nextToken).map((note) => (
          <FooterNote key={note} text={note} width={body} />
        ))}
      </box>
    </Frame>
  )
}

export function ApplicationBoxCard({
  applicationId,
  boxName,
  exists,
  value,
  size,
  width,
}: {
  applicationId: number | string
  boxName: string
  exists: boolean
  value?: string
  size?: number
  width: number
}) {
  const body = innerWidth(width)
  return (
    <Frame width={width} accent={exists ? COLORS.border : COLORS.muted}>
      <Header kicker="APP BOX" pill={exists ? 'EXISTS' : 'MISSING'} tone={exists ? 'ok' : 'idle'} />
      <box marginTop={1} flexDirection="column">
        <Fact
          label="app"
          value={String(applicationId)}
          copy={String(applicationId)}
          width={body}
        />
        <Fact label="name" value={boxName} width={body} />
        {exists && size !== undefined ? (
          <Fact label="size" value={`${size} bytes`} width={body} />
        ) : null}
        {exists ? <Fact label="value" value={value ?? ''} width={body} /> : null}
        {exists ? null : (
          <text fg={COLORS.muted} marginTop={1} content="box does not exist" />
        )}
      </box>
    </Frame>
  )
}

export function BlockListCard({
  blocks,
  nextToken,
  width,
}: {
  blocks: ReadonlyArray<{
    round: number
    timestamp: number
    transactionCount: number
    proposer?: string
  }>
  nextToken?: string
  width: number
}) {
  const body = innerWidth(width)
  const rows = blocks.slice(0, 10)
  return (
    <Frame width={width}>
      <Header kicker="BLOCKS" pill={String(blocks.length)} tone="idle" />
      <box flexDirection="column">
        {rows.map((block, index) => (
          <box key={block.round} flexDirection="column" marginTop={1}>
            <Fact
              label="round"
              value={String(block.round)}
              copy={String(block.round)}
              width={body}
            />
            <Fact label="time" value={formatExplorerTime(block.timestamp)} width={body} />
            <Fact
              label="txns"
              value={`${block.transactionCount} txn${block.transactionCount === 1 ? '' : 's'}`}
              width={body}
            />
            {block.proposer ? (
              <Fact label="proposer" value={block.proposer} copy={block.proposer} width={body} />
            ) : null}
            {index < rows.length - 1 ? <Rule width={body} /> : null}
          </box>
        ))}
        {pageNotes(blocks.length, rows.length, nextToken).map((note) => (
          <FooterNote key={note} text={note} width={body} />
        ))}
      </box>
    </Frame>
  )
}

export function RawCard({
  title,
  text,
  width,
}: {
  title: string
  text: string
  width: number
}) {
  const lines = text.split('\n')
  const shown = lines.slice(0, 14)
  if (lines.length > 14) shown.push(`… ${lines.length - 14} more lines`)
  return (
    <Card title={title.toUpperCase()} badge="RAW" tone="idle" lines={shown} width={width} />
  )
}

function signedDelta(value: number | string): string {
  const formatted = formatMicroAlgos(value)
  return formatted.startsWith('-') || formatted === '0' ? formatted : `+${formatted}`
}

/** Flat lines for tests and for hosts that still want a text dump. */
export function paymentLines(model: PaymentFlowViewModel): string[] {
  const lines = [
    `${formatMicroAlgos(model.amountMicroAlgos)} ALGO · ${model.network}`,
    `from  ${model.sender}`,
    `to    ${model.receiver}`,
  ]
  if (model.simulation) {
    lines.push(
      `${model.simulation.wouldSucceed ? 'would succeed' : 'WOULD FAIL'} · fee ${formatMicroAlgos(model.simulation.feeMicroAlgos)} ALGO${model.simulation.simulatedRound === undefined ? '' : ` · round ${model.simulation.simulatedRound}`}`,
    )
    if (model.simulation.failureMessage) lines.push(`why: ${model.simulation.failureMessage}`)
    for (const effect of model.simulation.effects) {
      lines.push(`  ${effect.role.padEnd(8)} ${signedDelta(effect.deltaMicroAlgos)} ALGO`)
    }
  }
  if (model.approval && model.approval.state !== 'pending') {
    lines.push(
      `approval: ${model.approval.state}${model.approval.reason ? ` · ${model.approval.reason}` : ''}`,
    )
  }
  if (model.signed) lines.push(`signed by keystore · ${model.signed.txIds[0]!}`)
  if (model.confirmation) {
    lines.push(
      `confirmed · round ${model.confirmation.confirmedRound} · ${model.confirmation.transactionId}`,
    )
  }
  return lines
}

export function PaymentBody({
  model,
  width,
}: {
  model: PaymentFlowViewModel
  width: number
}) {
  const failed = model.simulation?.wouldSucceed === false
  return (
    <box flexDirection="column">
      <Hero value={formatMicroAlgos(model.amountMicroAlgos)} unit="ALGO" />
      <PartyPath from={model.sender} to={model.receiver} width={width} />
      <box marginTop={1} flexDirection="column">
        <Rule width={width} />
        <Fact label="network" value={model.network} width={width} />
        {model.note ? <Fact label="note" value={model.note} width={width} /> : null}
        {model.simulation ? (
          <Fact
            label="sim"
            value={model.simulation.wouldSucceed ? 'would succeed' : 'WOULD FAIL'}
            width={width}
            valueColor={failed ? COLORS.red : COLORS.green}
          />
        ) : null}
        {model.simulation ? (
          <Fact label="fee" value={algo(model.simulation.feeMicroAlgos) ?? '—'} width={width} />
        ) : null}
        {model.simulation?.simulatedRound === undefined ? null : (
          <Fact
            label="round"
            value={String(model.simulation.simulatedRound)}
            copy={String(model.simulation.simulatedRound)}
            width={width}
          />
        )}
        {model.simulation?.failureMessage ? (
          <Fact
            label="why"
            value={model.simulation.failureMessage}
            width={width}
            valueColor={COLORS.red}
          />
        ) : null}
        {model.simulation
          ? model.simulation.effects.map((effect) => (
              <Fact
                key={`${effect.role}-${effect.account}`}
                label={effect.role}
                value={`${signedDelta(effect.deltaMicroAlgos)} ALGO`}
                width={width}
                valueColor={
                  String(effect.deltaMicroAlgos).startsWith('-') ? COLORS.red : COLORS.green
                }
              />
            ))
          : null}
        {model.approval && model.approval.state !== 'pending' ? (
          <Fact
            label="approval"
            value={`${model.approval.state}${model.approval.reason ? ` · ${model.approval.reason}` : ''}`}
            width={width}
          />
        ) : null}
        {model.signed ? (
          <Fact
            label="signed"
            value={model.signed.txIds[0] ?? ''}
            copy={model.signed.txIds[0]}
            width={width}
          />
        ) : null}
        {model.confirmation ? (
          <Fact
            label="round"
            value={String(model.confirmation.confirmedRound)}
            copy={String(model.confirmation.confirmedRound)}
            width={width}
            valueColor={COLORS.green}
          />
        ) : null}
        {model.confirmation ? (
          <Fact
            label="id"
            value={model.confirmation.transactionId}
            copy={model.confirmation.transactionId}
            width={width}
            valueColor={COLORS.green}
          />
        ) : null}
      </box>
    </box>
  )
}

export function PaymentCard({
  model,
  stage,
  busy,
  width,
}: {
  model: PaymentFlowViewModel | undefined
  stage: string
  busy: boolean
  width: number
}) {
  if (!model) return <Unavailable title="PAYMENT" width={width} />
  const failed = model.simulation?.wouldSucceed === false
  const badge = busy
    ? 'WORKING…'
    : stage === 'awaiting-approval'
      ? failed
        ? 'SIMULATION FAILED'
        : 'AWAITING APPROVAL'
      : stage === 'confirmed'
        ? 'CONFIRMED'
        : stage === 'denied'
          ? 'DENIED'
          : stage.toUpperCase()
  const tone: Tone =
    stage === 'denied' || failed ? 'bad' : stage === 'confirmed' ? 'ok' : 'warn'
  return (
    <Frame width={width} accent={tone === 'bad' ? COLORS.red : tone === 'ok' ? COLORS.green : COLORS.brass}>
      <Header kicker="PAYMENT" pill={badge} tone={tone} />
      <PaymentBody model={model} width={innerWidth(width)} />
    </Frame>
  )
}
