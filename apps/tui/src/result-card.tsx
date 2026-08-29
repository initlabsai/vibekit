/** ViewSpec → card: the one switch that maps every trusted view id to its feature's card. */
import { useState } from 'react'

import {
  findResultRecord,
  nextPageArgs,
  createAccountListViewModel,
  createAccountPortfolioViewModel,
  createAccountSummaryViewModel,
  createApplicationBoxViewModel,
  createApplicationBoxesViewModel,
  createApplicationDetailViewModel,
  createApplicationListViewModel,
  createApplicationLocalsViewModel,
  createApplicationLogsViewModel,
  createApplicationProgramViewModel,
  createApplicationMethodsViewModel,
  createApplicationExplanationViewModel,
  createApplicationStateViewModel,
  createAssetDetailViewModel,
  createAssetHoldersViewModel,
  createAssetHoldingsViewModel,
  createAssetListViewModel,
  createBlockDetailViewModel,
  createBlockListViewModel,
  createNetworkStatusViewModel,
  createArcadeMarketViewModel,
  createArcadeMarketsViewModel,
  createArcadeOrderbookViewModel,
  createArcadeOrdersViewModel,
  createArcadePositionsViewModel,
  createDefiProtocolsViewModel,
  createNfdProfileViewModel,
  createPeraAssetViewModel,
  createWebPageViewModel,
  createWebResultsViewModel,
  createSwapQuoteViewModel,
  createVestigeHistoryViewModel,
  createVestigeMarketsViewModel,
  createVestigePricesViewModel,
  createTransactionCollectionViewModel,
  createTransactionDetailViewModel,
  type ResultStore,
  type ViewSpec,
  type TransactionSearchFilter,
} from '@initlabs/vibekit-explorer'

import {
  AccountCard,
  AccountListCard,
  AccountSummaryCard,
  nextAssetSort,
  type AssetSort,
} from './features/accounts/cards.js'
import { buildGroupGraph } from './features/transactions/graph-layout.js'
import {
  ApplicationBoxCard,
  ApplicationBoxesCard,
  ApplicationCard,
  ApplicationListCard,
  ApplicationLocalsCard,
  ApplicationLogsCard,
  ApplicationProgramCard,
  ApplicationMethodsCard,
  ApplicationExplanationCard,
  ApplicationStateCard,
} from './features/apps/cards.js'
import {
  AssetCard,
  AssetHoldersCard,
  AssetHoldingsCard,
  AssetListCard,
} from './features/assets/cards.js'
import { BlockCard, BlockListCard } from './features/blocks/cards.js'
import { NetworkCard } from './features/network/cards.js'
import {
  DefiOverviewCard,
  MarketPricesCard,
  MarketRankedCard,
  PriceHistoryCard,
} from './features/plugins/market.js'
import {
  MarketCard,
  MarketsCard,
  OrderbookCard,
  OrdersCard,
  PositionsCard,
} from './features/plugins/arcade.js'
import { NfdCard } from './features/plugins/nfd.js'
import { SwapQuoteCard } from './features/plugins/swap.js'
import { WebPageCard, WebResultsCard } from './features/plugins/web.js'
import { PeraAssetCard } from './features/plugins/pera.js'
import { TransactionCard, TransactionListCard } from './features/transactions/cards.js'
import { TransactionGraphCard } from './features/transactions/graph.js'
import { Unavailable } from './primitives.js'

/** A thing a card can ask the app to open. */
export type OpenTarget =
  | { kind: 'transaction'; txid: string }
  | { kind: 'account'; address: string }
  | { kind: 'asset'; assetId: number }
  | { kind: 'application'; applicationId: number }
  /** Ask the agent to read and explain an application's program — never to audit it. */
  | { kind: 'program'; applicationId: number }
  | { kind: 'block'; round: number }
  | { kind: 'transactions'; filter: TransactionSearchFilter }
  /** Every asset an account holds, as a paged list. */
  | { kind: 'holdings'; address: string }

/** The filter a detail card's "transactions ▸" opens, when the view has one. */
export function transactionsFilterFor(
  store: ResultStore,
  view: ViewSpec,
): TransactionSearchFilter | undefined {
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

/** Renders one trusted view as a TUI card. */
export function ResultCard({
  store,
  view,
  width,
  onOpen,
  onMore,
  loadingMore,
}: {
  store: ResultStore
  view: ViewSpec
  width: number
  /** Drill-in from a row or a card action; the app routes it to a lane. */
  onOpen?: (target: OpenTarget) => void
  /** Fetches the next page of a transaction list into this card. */
  onMore?: () => void
  loadingMore?: boolean
}) {
  // Presentation toggles are this card's own: the header buttons flip them.
  const [sort, setSort] = useState<AssetSort>('none')
  const [flow, setFlow] = useState<'graph' | 'table'>('graph')
  const [layout, setLayout] = useState<'stack' | 'table'>('stack')
  const filter = onOpen ? transactionsFilterFor(store, view) : undefined
  const onTransactions =
    onOpen && filter ? () => onOpen({ kind: 'transactions', filter }) : undefined
  // A list pages when its record remembers its own call and has a token.
  const more = onMore && nextPageArgs(findResultRecord(store, view.source)) ? onMore : undefined
  switch (view.view) {
    case 'transaction.detail': {
      const derived = createTransactionDetailViewModel(store, view)
      if (!derived.ok) return <TransactionCard model={undefined} width={width} />
      const model = derived.model
      // Every detail gets the flow graph a group does (inner txns included).
      const graph = buildGroupGraph([model])
      return (
        <box flexDirection="column">
          <TransactionCard model={derived.model} width={width} />
          {graph ? (
            <TransactionGraphCard
              graph={graph}
              kicker={model.innerTxns?.length ? 'INNER TRANSACTIONS' : 'TRANSACTION'}
              transactionCount={1 + (model.innerTxns?.length ?? 0)}
              width={width}
            />
          ) : null}
        </box>
      )
    }
    case 'account.portfolio': {
      const derived = createAccountPortfolioViewModel(store, view)
      return (
        <AccountCard
          model={derived.ok ? derived.model : undefined}
          width={width}
          sort={sort}
          maxAssets={20}
          onCycleSort={() => setSort(nextAssetSort(sort))}
          onTransactions={onTransactions}
          onAssets={
            onOpen && filter?.address
              ? () => onOpen({ kind: 'holdings', address: filter.address! })
              : undefined
          }
        />
      )
    }
    case 'asset.detail': {
      const derived = createAssetDetailViewModel(store, view)
      return (
        <AssetCard
          model={derived.ok ? derived.model : undefined}
          width={width}
          onTransactions={onTransactions}
        />
      )
    }
    case 'application.detail': {
      const derived = createApplicationDetailViewModel(store, view)
      return (
        <ApplicationCard
          model={derived.ok ? derived.model : undefined}
          width={width}
          onTransactions={onTransactions}
          onExplain={
            onOpen && derived.ok
              ? () =>
                  onOpen({ kind: 'program', applicationId: Number(derived.model.applicationId) })
              : undefined
          }
        />
      )
    }
    case 'block.detail': {
      const derived = createBlockDetailViewModel(store, view)
      return (
        <BlockCard
          model={derived.ok ? derived.model : undefined}
          width={width}
          onTransactions={onTransactions}
        />
      )
    }
    case 'network.status': {
      const derived = createNetworkStatusViewModel(store, view)
      return <NetworkCard model={derived.ok ? derived.model : undefined} width={width} />
    }
    case 'account.summary': {
      const derived = createAccountSummaryViewModel(store, view)
      if (!derived.ok) return <Unavailable title="ACCOUNT" width={width} />
      return <AccountSummaryCard {...derived.model} width={width} />
    }
    case 'account.list': {
      const derived = createAccountListViewModel(store, view)
      if (!derived.ok) return <Unavailable title="ACCOUNTS" width={width} />
      return (
        <AccountListCard
          accounts={derived.model.accounts}
          nextToken={derived.model.nextToken}
          onMore={more}
          loadingMore={loadingMore}
          missing={derived.model.missing}
          width={width}
          onOpen={onOpen ? (address) => onOpen({ kind: 'account', address }) : undefined}
        />
      )
    }
    case 'transaction.list':
    case 'transaction.group': {
      const derived = createTransactionCollectionViewModel(store, view)
      if (!derived.ok) {
        return (
          <Unavailable
            title={view.view === 'transaction.group' ? 'TRANSACTION GROUP' : 'TRANSACTIONS'}
            width={width}
          />
        )
      }
      if (view.view === 'transaction.group' && flow === 'graph') {
        // The card receives the derived graph model; it computes nothing.
        const graph = buildGroupGraph(derived.model.transactions)
        if (graph) {
          return (
            <TransactionGraphCard
              graph={graph}
              groupId={derived.model.groupId}
              transactionCount={derived.model.transactions.length}
              width={width}
              onShowTable={() => setFlow('table')}
            />
          )
        }
      }
      return (
        <TransactionListCard
          title={view.view === 'transaction.group' ? 'TRANSACTION GROUP' : 'TRANSACTIONS'}
          groupId={derived.model.groupId}
          transactions={derived.model.transactions}
          nextToken={derived.model.nextToken}
          query={derived.model.query}
          width={width}
          onOpen={onOpen ? (txid) => onOpen({ kind: 'transaction', txid }) : undefined}
          onMore={more}
          loadingMore={loadingMore}
          layout={layout}
          onToggleLayout={() => setLayout(layout === 'table' ? 'stack' : 'table')}
          onShowGraph={view.view === 'transaction.group' ? () => setFlow('graph') : undefined}
        />
      )
    }
    case 'asset.list': {
      const derived = createAssetListViewModel(store, view)
      if (!derived.ok) return <Unavailable title="ASSETS" width={width} />
      return (
        <AssetListCard
          assets={derived.model.assets}
          nextToken={derived.model.nextToken}
          onMore={more}
          loadingMore={loadingMore}
          width={width}
          onOpen={onOpen ? (assetId) => onOpen({ kind: 'asset', assetId }) : undefined}
        />
      )
    }
    case 'asset.holdings': {
      const derived = createAssetHoldingsViewModel(store, view)
      if (!derived.ok) return <Unavailable title="ASSET HOLDINGS" width={width} />
      return (
        <AssetHoldingsCard
          assets={derived.model.assets}
          nextToken={derived.model.nextToken}
          onMore={more}
          loadingMore={loadingMore}
          width={width}
          onOpen={onOpen ? (assetId) => onOpen({ kind: 'asset', assetId }) : undefined}
        />
      )
    }
    case 'asset.holders': {
      const derived = createAssetHoldersViewModel(store, view)
      if (!derived.ok) return <Unavailable title="HOLDERS" width={width} />
      return (
        <AssetHoldersCard
          balances={derived.model.balances}
          decimals={derived.model.decimals}
          nextToken={derived.model.nextToken}
          onMore={more}
          loadingMore={loadingMore}
          width={width}
        />
      )
    }
    case 'application.list': {
      const derived = createApplicationListViewModel(store, view)
      if (!derived.ok) return <Unavailable title="APPLICATIONS" width={width} />
      return (
        <ApplicationListCard
          applications={derived.model.applications}
          nextToken={derived.model.nextToken}
          onMore={more}
          loadingMore={loadingMore}
          width={width}
          onOpen={
            onOpen ? (applicationId) => onOpen({ kind: 'application', applicationId }) : undefined
          }
        />
      )
    }
    case 'application.state': {
      const derived = createApplicationStateViewModel(store, view)
      if (!derived.ok) return <Unavailable title="APP STATE" width={width} />
      return <ApplicationStateCard {...derived.model} width={width} />
    }
    case 'application.locals': {
      const derived = createApplicationLocalsViewModel(store, view)
      if (!derived.ok) return <Unavailable title="APP LOCALS" width={width} />
      return (
        <ApplicationLocalsCard
          address={derived.model.address}
          apps={derived.model.apps}
          nextToken={derived.model.nextToken}
          onMore={more}
          loadingMore={loadingMore}
          width={width}
        />
      )
    }
    case 'application.program': {
      const derived = createApplicationProgramViewModel(store, view)
      return <ApplicationProgramCard model={derived.ok ? derived.model : undefined} width={width} />
    }
    case 'application.methods': {
      const derived = createApplicationMethodsViewModel(store, view)
      return <ApplicationMethodsCard model={derived.ok ? derived.model : undefined} width={width} />
    }
    case 'nfd.profile': {
      const derived = createNfdProfileViewModel(store, view)
      if (!derived.ok) return <Unavailable title="NFD" width={width} />
      const nfd = derived.model
      return (
        <NfdCard
          data={nfd}
          network={nfd.network}
          width={width}
          onOpenAccount={
            onOpen && nfd.address
              ? () => onOpen({ kind: 'account', address: nfd.address! })
              : undefined
          }
        />
      )
    }
    case 'vestige.prices': {
      const derived = createVestigePricesViewModel(store, view)
      if (!derived.ok) return <Unavailable title="PRICES" width={width} />
      return (
        <MarketPricesCard
          data={derived.model}
          network={derived.model.network}
          width={width}
          onOpen={onOpen ? (assetId) => onOpen({ kind: 'asset', assetId }) : undefined}
        />
      )
    }
    case 'vestige.markets': {
      const derived = createVestigeMarketsViewModel(store, view)
      if (!derived.ok) return <Unavailable title="MARKETS" width={width} />
      return (
        <MarketRankedCard
          data={derived.model}
          network={derived.model.network}
          width={width}
          onOpen={onOpen ? (assetId) => onOpen({ kind: 'asset', assetId }) : undefined}
        />
      )
    }
    case 'vestige.history': {
      const derived = createVestigeHistoryViewModel(store, view)
      if (!derived.ok) return <Unavailable title="PRICE" width={width} />
      return (
        <PriceHistoryCard
          data={derived.model}
          network={derived.model.network}
          width={width}
          onOpen={onOpen ? (assetId) => onOpen({ kind: 'asset', assetId }) : undefined}
        />
      )
    }
    case 'vestige.protocols': {
      const derived = createDefiProtocolsViewModel(store, view)
      if (!derived.ok) return <Unavailable title="DEFI" width={width} />
      return <DefiOverviewCard data={derived.model} network={derived.model.network} width={width} />
    }
    case 'haystack.quote': {
      const derived = createSwapQuoteViewModel(store, view)
      if (!derived.ok) return <Unavailable title="QUOTE" width={width} />
      return <SwapQuoteCard data={derived.model} network={derived.model.network} width={width} />
    }
    case 'arcade.markets': {
      const derived = createArcadeMarketsViewModel(store, view)
      if (!derived.ok) return <Unavailable title="MARKETS" width={width} />
      return (
        <MarketsCard
          data={derived.model}
          network={derived.model.network}
          width={width}
          onOpen={
            onOpen ? (applicationId) => onOpen({ kind: 'application', applicationId }) : undefined
          }
        />
      )
    }
    case 'arcade.market': {
      const derived = createArcadeMarketViewModel(store, view)
      if (!derived.ok) return <Unavailable title="MARKET" width={width} />
      return <MarketCard data={derived.model} network={derived.model.network} width={width} />
    }
    case 'arcade.orderbook': {
      const derived = createArcadeOrderbookViewModel(store, view)
      if (!derived.ok) return <Unavailable title="ORDERBOOK" width={width} />
      return <OrderbookCard data={derived.model} width={width} />
    }
    case 'arcade.positions': {
      const derived = createArcadePositionsViewModel(store, view)
      if (!derived.ok) return <Unavailable title="POSITIONS" width={width} />
      return (
        <PositionsCard
          data={derived.model}
          width={width}
          onOpen={
            onOpen ? (applicationId) => onOpen({ kind: 'application', applicationId }) : undefined
          }
        />
      )
    }
    case 'arcade.orders': {
      const derived = createArcadeOrdersViewModel(store, view)
      if (!derived.ok) return <Unavailable title="OPEN ORDERS" width={width} />
      return <OrdersCard data={derived.model} width={width} />
    }
    case 'web.results': {
      const derived = createWebResultsViewModel(store, view)
      if (!derived.ok) return <Unavailable title="WEB" width={width} />
      return <WebResultsCard data={derived.model} width={width} />
    }
    case 'web.page': {
      const derived = createWebPageViewModel(store, view)
      if (!derived.ok) return <Unavailable title="PAGE" width={width} />
      return <WebPageCard data={derived.model} width={width} />
    }
    case 'pera.asset': {
      const derived = createPeraAssetViewModel(store, view)
      if (!derived.ok) return <Unavailable title="ASSET PROFILE" width={width} />
      return (
        <PeraAssetCard
          data={derived.model}
          network={derived.model.network}
          width={width}
          onOpen={onOpen ? (assetId) => onOpen({ kind: 'asset', assetId }) : undefined}
        />
      )
    }
    case 'application.explanation': {
      const derived = createApplicationExplanationViewModel(store, view)
      return (
        <ApplicationExplanationCard model={derived.ok ? derived.model : undefined} width={width} />
      )
    }
    case 'application.logs': {
      const derived = createApplicationLogsViewModel(store, view)
      if (!derived.ok) return <Unavailable title="APP LOGS" width={width} />
      return (
        <ApplicationLogsCard
          applicationId={derived.model.applicationId}
          logData={derived.model.logData}
          nextToken={derived.model.nextToken}
          onMore={more}
          loadingMore={loadingMore}
          width={width}
        />
      )
    }
    case 'application.box': {
      const derived = createApplicationBoxViewModel(store, view)
      if (!derived.ok) return <Unavailable title="APP BOX" width={width} />
      return <ApplicationBoxCard {...derived.model} width={width} />
    }
    case 'application.boxes': {
      const derived = createApplicationBoxesViewModel(store, view)
      if (!derived.ok) return <Unavailable title="APP BOXES" width={width} />
      return <ApplicationBoxesCard {...derived.model} width={width} />
    }
    case 'block.list': {
      const derived = createBlockListViewModel(store, view)
      if (!derived.ok) return <Unavailable title="BLOCKS" width={width} />
      return (
        <BlockListCard
          blocks={derived.model.blocks}
          nextToken={derived.model.nextToken}
          onMore={more}
          loadingMore={loadingMore}
          width={width}
          onOpen={onOpen ? (round) => onOpen({ kind: 'block', round }) : undefined}
        />
      )
    }
  }
}
