'use client'

/** The one place a view id becomes UI: every trusted view spec renders through this exhaustive switch. */
import {
  createAccountListViewModel,
  createAccountPortfolioViewModel,
  createAccountSummaryViewModel,
  createApplicationDetailViewModel,
  createAssetDetailViewModel,
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

/** A record whose view has no card of its own: its top-level scalars as facts, then the first list. */
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
}: {
  store: ResultStore
  view: ViewSpec
  onOpen?: (target: OpenTarget) => void
  /** Fetches the next page into this card. */
  onMore?: () => void
  loadingMore?: boolean
}) {
  const filter = onOpen ? transactionsFilterFor(store, view) : undefined
  const onTransactions = onOpen && filter ? () => onOpen({ kind: 'transactions', filter }) : undefined
  const more = onMore && nextPageArgs(findResultRecord(store, view.source)) ? onMore : undefined
  switch (view.view) {
    case 'transaction.detail': {
      const derived = createTransactionDetailViewModel(store, view)
      return <TransactionCard model={derived.ok ? derived.model : undefined} onOpen={onOpen} />
    }
    case 'transaction.list':
    case 'transaction.group': {
      const derived = createTransactionCollectionViewModel(store, view)
      const title = view.view === 'transaction.group' ? 'TRANSACTION GROUP' : 'TRANSACTIONS'
      if (!derived.ok) return <Unavailable title={title} />
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
      return (
        <AccountCard
          model={derived.ok ? derived.model : undefined}
          onTransactions={onTransactions}
          onAssets={onOpen && filter?.address ? () => onOpen({ kind: 'holdings', address: filter.address! }) : undefined}
          onOpenAsset={onOpen ? (assetId) => onOpen({ kind: 'asset', assetId }) : undefined}
        />
      )
    }
    case 'account.summary': {
      const derived = createAccountSummaryViewModel(store, view)
      return derived.ok ? <AccountSummaryCard model={derived.model} /> : <Unavailable title="ACCOUNT" />
    }
    case 'account.list': {
      const derived = createAccountListViewModel(store, view)
      if (!derived.ok) return <Unavailable title="ACCOUNTS" />
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
      return (
        <BlockCard
          model={derived.ok ? derived.model : undefined}
          onTransactions={onTransactions}
          onOpenBlock={onOpen ? (round) => onOpen({ kind: 'block', round }) : undefined}
        />
      )
    }
    case 'block.list': {
      const derived = createBlockListViewModel(store, view)
      if (!derived.ok) return <Unavailable title="BLOCKS" />
      return (
        <BlockListCard
          blocks={derived.model.blocks}
          nextToken={derived.model.nextToken}
          onMore={more}
          loadingMore={loadingMore}
          onOpen={onOpen ? (round) => onOpen({ kind: 'block', round }) : undefined}
        />
      )
    }
    case 'network.status': {
      const derived = createNetworkStatusViewModel(store, view)
      return <NetworkCard model={derived.ok ? derived.model : undefined} />
    }
    case 'asset.detail':
    case 'asset.list':
    case 'asset.holdings':
    case 'asset.holders':
    case 'application.detail':
    case 'application.list':
    case 'application.state':
    case 'application.locals':
    case 'application.logs':
    case 'application.box':
    case 'application.boxes':
    case 'application.program':
    case 'application.methods':
    case 'application.explanation':
      return <RawCard store={store} view={view} />
  }
}
