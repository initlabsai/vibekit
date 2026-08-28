'use client'

/** The one place a view id becomes UI: every trusted view spec renders through this exhaustive switch. */
import {
  createAccountListViewModel,
  createAccountPortfolioViewModel,
  createAccountSummaryViewModel,
  createApplicationBoxViewModel,
  createApplicationBoxesViewModel,
  createApplicationDetailViewModel,
  createApplicationExplanationViewModel,
  createApplicationListViewModel,
  createApplicationLocalsViewModel,
  createApplicationLogsViewModel,
  createApplicationMethodsViewModel,
  createApplicationProgramViewModel,
  createApplicationStateViewModel,
  createAssetDetailViewModel,
  createAssetHoldersViewModel,
  createAssetHoldingsViewModel,
  createAssetListViewModel,
  createBlockDetailViewModel,
  createBlockListViewModel,
  createNetworkStatusViewModel,
  createTransactionCollectionViewModel,
  createTransactionDetailViewModel,
  findResultRecord,
  nextPageArgs,
  type ResultStore,
  type TransactionSearchFilter,
  type ViewSpec,
} from '@initlabs/vibekit-explorer'

import { AccountCard, AccountListCard, AccountSummaryCard } from './features/accounts/cards'
import {
  ApplicationBoxCard,
  ApplicationBoxesCard,
  ApplicationCard,
  ApplicationExplanationCard,
  ApplicationListCard,
  ApplicationLocalsCard,
  ApplicationLogsCard,
  ApplicationMethodsCard,
  ApplicationProgramCard,
  ApplicationStateCard,
} from './features/apps/cards'
import { AssetCard, AssetHoldersCard, AssetHoldingsCard, AssetListCard } from './features/assets/cards'
import { BlockCard, BlockListCard } from './features/blocks/cards'
import { NetworkCard } from './features/network/cards'
import { TransactionCard, TransactionListCard } from './features/transactions/cards'
import { Facts, Fact, Frame, Header, Unavailable } from './primitives'

/** Where a card's touchable can take the feed; UI routing, not protocol. */
export type OpenTarget =
  | { kind: 'transaction'; txid: string }
  | { kind: 'account'; address: string }
  | { kind: 'asset'; assetId: number }
  | { kind: 'application'; applicationId: number }
  | { kind: 'block'; round: number }
  | { kind: 'transactions'; filter: TransactionSearchFilter }
  | { kind: 'holdings'; address: string }

/** The filter a detail card's "transactions ▸" opens, when the view has one. */
export function transactionsFilterFor(store: ResultStore, view: ViewSpec): TransactionSearchFilter | undefined {
  switch (view.view) {
    case 'account.portfolio': {
      const derived = createAccountPortfolioViewModel(store, view)
      return derived.ok ? { address: derived.model.address } : undefined
    }
    case 'asset.detail': {
      const derived = createAssetDetailViewModel(store, view)
      return derived.ok ? { assetId: Number(derived.model.assetId) } : undefined
    }
    case 'application.detail': {
      const derived = createApplicationDetailViewModel(store, view)
      return derived.ok ? { applicationId: Number(derived.model.applicationId) } : undefined
    }
    case 'block.detail': {
      const derived = createBlockDetailViewModel(store, view)
      return derived.ok ? { round: derived.model.round } : undefined
    }
    default:
      return undefined
  }
}

/** A degraded record — the view could not derive — shown as its top-level scalars, then the first list. */
export function RawCard({ store, view }: { store: ResultStore; view: ViewSpec }) {
  const record = findResultRecord(store, view.source)
  if (!record) return <Unavailable title={view.view.toUpperCase()} />
  const data: unknown = record.state === 'success' ? record.data : record.error
  const object = data !== null && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  const scalars = Object.entries(object).filter(([, value]) => typeof value !== 'object' || value === null)
  const list = Object.entries(object).find(([, value]) => Array.isArray(value) && value.every((v) => typeof v === 'object'))
  return (
    <Frame>
      <Header kicker={view.view.toUpperCase()} chip={record.network} pill={record.state === 'error' ? 'FAILED' : undefined} tone="bad" />
      <Facts>
        {scalars.map(([key, value]) => (
          <Fact key={key} label={key} value={String(value)} />
        ))}
      </Facts>
      {list ? (
        <pre className="raw">{JSON.stringify(list[1], null, 2)}</pre>
      ) : null}
    </Frame>
  )
}

export function ResultCard({
  store,
  view,
  onOpen,
  onMore,
  loadingMore,
  tailing = false,
}: {
  store: ResultStore
  view: ViewSpec
  onOpen?: (target: OpenTarget) => void
  /** Fetches the next page into this card. */
  onMore?: () => void
  loadingMore?: boolean
  /** A block list that follows the chain. */
  tailing?: boolean
}) {
  const filter = onOpen ? transactionsFilterFor(store, view) : undefined
  const onTransactions = onOpen && filter ? () => onOpen({ kind: 'transactions', filter }) : undefined
  const more = onMore && nextPageArgs(findResultRecord(store, view.source)) ? onMore : undefined
  switch (view.view) {
    case 'transaction.detail': {
      const derived = createTransactionDetailViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return <TransactionCard model={derived.model} onOpen={onOpen} />
    }
    case 'transaction.list':
    case 'transaction.group': {
      const derived = createTransactionCollectionViewModel(store, view)
      const title = view.view === 'transaction.group' ? 'TRANSACTION GROUP' : 'TRANSACTIONS'
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <TransactionListCard
          title={title}
          groupId={derived.model.groupId}
          transactions={derived.model.transactions}
          nextToken={derived.model.nextToken}
          query={derived.model.query}
          onOpen={onOpen ? (txid) => onOpen({ kind: 'transaction', txid }) : undefined}
          onMore={more}
          loadingMore={loadingMore}
        />
      )
    }
    case 'account.portfolio': {
      const derived = createAccountPortfolioViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <AccountCard
          model={derived.model}
          onTransactions={onTransactions}
          onAssets={onOpen && filter?.address ? () => onOpen({ kind: 'holdings', address: filter.address! }) : undefined}
          onOpenAsset={onOpen ? (assetId) => onOpen({ kind: 'asset', assetId }) : undefined}
        />
      )
    }
    case 'account.summary': {
      const derived = createAccountSummaryViewModel(store, view)
      return derived.ok ? <AccountSummaryCard model={derived.model} /> : <RawCard store={store} view={view} />
    }
    case 'account.list': {
      const derived = createAccountListViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <AccountListCard
          accounts={derived.model.accounts}
          nextToken={derived.model.nextToken}
          missing={derived.model.missing}
          onMore={more}
          loadingMore={loadingMore}
          onOpen={onOpen ? (address) => onOpen({ kind: 'account', address }) : undefined}
        />
      )
    }
    case 'block.detail': {
      const derived = createBlockDetailViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <BlockCard
          model={derived.model}
          onTransactions={onTransactions}
          onOpenBlock={onOpen ? (round) => onOpen({ kind: 'block', round }) : undefined}
        />
      )
    }
    case 'block.list': {
      const derived = createBlockListViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <BlockListCard
          blocks={derived.model.blocks}
          nextToken={derived.model.nextToken}
          tailing={tailing}
          onMore={more}
          loadingMore={loadingMore}
          onOpen={onOpen ? (round) => onOpen({ kind: 'block', round }) : undefined}
        />
      )
    }
    case 'network.status': {
      const derived = createNetworkStatusViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return <NetworkCard model={derived.model} />
    }
    case 'asset.detail': {
      const derived = createAssetDetailViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return <AssetCard model={derived.model} onTransactions={onTransactions} />
    }
    case 'asset.list': {
      const derived = createAssetListViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <AssetListCard
          assets={derived.model.assets}
          nextToken={derived.model.nextToken}
          onMore={more}
          loadingMore={loadingMore}
          onOpen={onOpen ? (assetId) => onOpen({ kind: 'asset', assetId }) : undefined}
        />
      )
    }
    case 'asset.holdings': {
      const derived = createAssetHoldingsViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <AssetHoldingsCard
          assets={derived.model.assets}
          nextToken={derived.model.nextToken}
          onMore={more}
          loadingMore={loadingMore}
          onOpen={onOpen ? (assetId) => onOpen({ kind: 'asset', assetId }) : undefined}
        />
      )
    }
    case 'asset.holders': {
      const derived = createAssetHoldersViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <AssetHoldersCard
          balances={derived.model.balances}
          decimals={derived.model.decimals}
          nextToken={derived.model.nextToken}
          onMore={more}
          loadingMore={loadingMore}
          onOpen={onOpen ? (address) => onOpen({ kind: 'account', address }) : undefined}
        />
      )
    }
    case 'application.detail': {
      const derived = createApplicationDetailViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return <ApplicationCard model={derived.model} onTransactions={onTransactions} />
    }
    case 'application.list': {
      const derived = createApplicationListViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <ApplicationListCard
          applications={derived.model.applications}
          nextToken={derived.model.nextToken}
          onMore={more}
          loadingMore={loadingMore}
          onOpen={onOpen ? (applicationId) => onOpen({ kind: 'application', applicationId }) : undefined}
        />
      )
    }
    case 'application.state': {
      const derived = createApplicationStateViewModel(store, view)
      return derived.ok ? <ApplicationStateCard {...derived.model} /> : <RawCard store={store} view={view} />
    }
    case 'application.locals': {
      const derived = createApplicationLocalsViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <ApplicationLocalsCard
          address={derived.model.address}
          apps={derived.model.apps}
          nextToken={derived.model.nextToken}
          onMore={more}
          loadingMore={loadingMore}
          onOpen={onOpen ? (applicationId) => onOpen({ kind: 'application', applicationId }) : undefined}
        />
      )
    }
    case 'application.logs': {
      const derived = createApplicationLogsViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <ApplicationLogsCard
          applicationId={derived.model.applicationId}
          logData={derived.model.logData}
          nextToken={derived.model.nextToken}
          onMore={more}
          loadingMore={loadingMore}
          onOpen={onOpen ? (txid) => onOpen({ kind: 'transaction', txid }) : undefined}
        />
      )
    }
    case 'application.box': {
      const derived = createApplicationBoxViewModel(store, view)
      return derived.ok ? <ApplicationBoxCard {...derived.model} /> : <RawCard store={store} view={view} />
    }
    case 'application.boxes': {
      const derived = createApplicationBoxesViewModel(store, view)
      return derived.ok ? <ApplicationBoxesCard {...derived.model} /> : <RawCard store={store} view={view} />
    }
    case 'application.program': {
      const derived = createApplicationProgramViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return <ApplicationProgramCard model={derived.model} />
    }
    case 'application.methods': {
      const derived = createApplicationMethodsViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return <ApplicationMethodsCard model={derived.model} />
    }
    case 'application.explanation': {
      const derived = createApplicationExplanationViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return <ApplicationExplanationCard model={derived.model} />
    }
  }
}
