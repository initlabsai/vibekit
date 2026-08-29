'use client'

import { useState } from 'react'

/** The one place a view id becomes UI: every trusted view spec renders through this exhaustive switch. */
import {
  formatBaseUnits,
  createArcadeMarketViewModel,
  createArcadeMarketsViewModel,
  createArcadeOrderbookViewModel,
  createArcadeOrdersViewModel,
  createArcadePositionsViewModel,
  createDefiProtocolsViewModel,
  createNfdProfileViewModel,
  createPeraAssetViewModel,
  createSwapQuoteViewModel,
  createVestigeHistoryViewModel,
  createVestigeMarketsViewModel,
  createVestigePricesViewModel,
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
import {
  AssetCard,
  AssetHoldersCard,
  AssetHoldingsCard,
  AssetListCard,
} from './features/assets/cards'
import { BlockCard, BlockListCard } from './features/blocks/cards'
import { NetworkCard } from './features/network/cards'
import {
  MarketCard,
  MarketsCard,
  OrderbookCard,
  OrdersCard,
  PositionsCard,
} from './features/plugins/arcade-cards'
import { DefiOverviewCard } from './features/plugins/defi-card'
import { MarketPricesCard, MarketRankedCard } from './features/plugins/market-cards'
import { PriceHistoryCard } from './features/plugins/price-history-card'
import { SwapQuoteCard } from './features/plugins/swap-quote-card'
import { NfdCard } from './features/plugins/nfd-card'
import { PeraAssetCard } from './features/plugins/pera-card'
import { TransactionCard, TransactionListCard } from './features/transactions/cards'
import { buildGroupGraph, TransactionGraphCard } from './features/transactions/graph'
import { Button, Facts, Fact, Frame, Header, Unavailable } from './primitives'

/** Where a card's touchable can take the feed; UI routing, not protocol. */
export type OpenTarget =
  | { kind: 'transaction'; txid: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'account'; address: string }
  | { kind: 'asset'; assetId: number }
  | { kind: 'application'; applicationId: number }
  | { kind: 'block'; round: number }
  | { kind: 'transactions'; filter: TransactionSearchFilter }
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

/** A degraded record — the view could not derive — shown as its top-level scalars, then the first list. */
export function RawCard({ store, view }: { store: ResultStore; view: ViewSpec }) {
  const record = findResultRecord(store, view.source)
  if (!record) return <Unavailable title={view.view.toUpperCase()} />
  const data: unknown = record.state === 'success' ? record.data : record.error
  const object =
    data !== null && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
  const scalars = Object.entries(object).filter(
    ([, value]) => typeof value !== 'object' || value === null,
  )
  const list = Object.entries(object).find(
    ([, value]) => Array.isArray(value) && value.every((v) => typeof v === 'object'),
  )
  return (
    <Frame>
      <Header
        kicker={view.view.toUpperCase()}
        chip={record.network}
        pill={record.state === 'error' ? 'FAILED' : undefined}
        tone="bad"
      />
      <Facts>
        {scalars.map(([key, value]) => (
          <Fact key={key} label={key} value={String(value)} />
        ))}
      </Facts>
      {list ? <pre className="raw">{JSON.stringify(list[1], null, 2)}</pre> : null}
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
  onInput,
}: {
  store: ResultStore
  view: ViewSpec
  onOpen?: (target: OpenTarget) => void
  /** Fetches the next page into this card. */
  onMore?: () => void
  /** Sends text as composer input (a card's range chips, a suggested next lookup). */
  onInput?: (text: string) => void
  loadingMore?: boolean
  /** A block list that follows the chain. */
  tailing?: boolean
}) {
  // A group shows its flow first; the table is one click away.
  const [flow, setFlow] = useState<'graph' | 'table'>('graph')
  const filter = onOpen ? transactionsFilterFor(store, view) : undefined
  const onTransactions =
    onOpen && filter ? () => onOpen({ kind: 'transactions', filter }) : undefined
  const more = onMore && nextPageArgs(findResultRecord(store, view.source)) ? onMore : undefined
  switch (view.view) {
    case 'transaction.detail': {
      const derived = createTransactionDetailViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      const model = derived.model
      // Every detail gets the flow graph a group does (inner txns included).
      const graph = buildGroupGraph([model])
      return (
        <>
          <TransactionCard model={model} onOpen={onOpen} />
          {graph ? (
            <TransactionGraphCard
              graph={graph}
              kicker={model.innerTxns?.length ? 'INNER TRANSACTIONS' : 'TRANSACTION'}
              transactionCount={1 + (model.innerTxns?.length ?? 0)}
            />
          ) : null}
        </>
      )
    }
    case 'transaction.list':
    case 'transaction.group': {
      const derived = createTransactionCollectionViewModel(store, view)
      const title = view.view === 'transaction.group' ? 'TRANSACTION GROUP' : 'TRANSACTIONS'
      if (!derived.ok) return <RawCard store={store} view={view} />
      if (view.view === 'transaction.group' && flow === 'graph') {
        const graph = buildGroupGraph(derived.model.transactions)
        if (graph) {
          return (
            <TransactionGraphCard
              graph={graph}
              groupId={derived.model.groupId}
              transactionCount={derived.model.transactions.length}
              action={<Button label="table" onPress={() => setFlow('table')} />}
            />
          )
        }
      }
      return (
        <TransactionListCard
          title={title}
          action={
            view.view === 'transaction.group' ? (
              <Button label="graph" onPress={() => setFlow('graph')} />
            ) : undefined
          }
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
          onAssets={
            onOpen && filter?.address
              ? () => onOpen({ kind: 'holdings', address: filter.address! })
              : undefined
          }
          onOpenAsset={onOpen ? (assetId) => onOpen({ kind: 'asset', assetId }) : undefined}
        />
      )
    }
    case 'account.summary': {
      const derived = createAccountSummaryViewModel(store, view)
      return derived.ok ? (
        <AccountSummaryCard model={derived.model} />
      ) : (
        <RawCard store={store} view={view} />
      )
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
      return <BlockCard model={derived.model} onTransactions={onTransactions} />
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
    case 'nfd.profile': {
      const derived = createNfdProfileViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      const nfd = derived.model
      return (
        <NfdCard
          data={nfd}
          network={nfd.network}
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
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <MarketPricesCard
          data={derived.model}
          network={derived.model.network}
          onOpen={onOpen ? (assetId) => onOpen({ kind: 'asset', assetId }) : undefined}
        />
      )
    }
    case 'vestige.markets': {
      const derived = createVestigeMarketsViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <MarketRankedCard
          data={derived.model}
          network={derived.model.network}
          onOpen={onOpen ? (assetId) => onOpen({ kind: 'asset', assetId }) : undefined}
        />
      )
    }
    case 'vestige.history': {
      const derived = createVestigeHistoryViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <PriceHistoryCard
          data={derived.model}
          network={derived.model.network}
          onRange={
            onInput ? (range) => onInput(`/price ${derived.model.assetId} ${range}`) : undefined
          }
          onOpen={onOpen ? (assetId) => onOpen({ kind: 'asset', assetId }) : undefined}
        />
      )
    }
    case 'vestige.protocols': {
      const derived = createDefiProtocolsViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return <DefiOverviewCard data={derived.model} network={derived.model.network} />
    }
    case 'haystack.quote': {
      const derived = createSwapQuoteViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      const quote = derived.model
      const amount = formatBaseUnits(quote.amountIn, quote.fromDecimals)
      return (
        <SwapQuoteCard
          data={quote}
          network={quote.network}
          onSwap={
            onInput
              ? () =>
                  onInput(
                    `swap ${amount} ${quote.fromUnit} (asset ${quote.fromAssetId}) to ${quote.toUnit} (asset ${quote.toAssetId})`,
                  )
              : undefined
          }
        />
      )
    }
    case 'arcade.markets': {
      const derived = createArcadeMarketsViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <MarketsCard
          data={derived.model}
          network={derived.model.network}
          onOpen={onInput ? (id) => onInput(`show market ${id}`) : undefined}
        />
      )
    }
    case 'arcade.market': {
      const derived = createArcadeMarketViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      const market = derived.model
      return (
        <MarketCard
          data={market}
          network={market.network}
          onBuy={
            onInput
              ? (side) => onInput(`buy ${side} on market ${market.marketAppId} (${market.title})`)
              : undefined
          }
          onOrderbook={
            onInput ? () => onInput(`orderbook for market ${market.marketAppId}`) : undefined
          }
        />
      )
    }
    case 'arcade.orderbook': {
      const derived = createArcadeOrderbookViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <OrderbookCard
          data={derived.model}
          onMarket={onInput ? () => onInput(`show market ${derived.model.marketAppId}`) : undefined}
        />
      )
    }
    case 'arcade.positions': {
      const derived = createArcadePositionsViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <PositionsCard
          data={derived.model}
          onOpen={onInput ? (id) => onInput(`show market ${id}`) : undefined}
        />
      )
    }
    case 'arcade.orders': {
      const derived = createArcadeOrdersViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <OrdersCard
          data={derived.model}
          onCancel={
            onInput
              ? (escrowAppId) =>
                  onInput(`cancel order ${escrowAppId} on market ${derived.model.marketAppId}`)
              : undefined
          }
        />
      )
    }
    case 'pera.asset': {
      const derived = createPeraAssetViewModel(store, view)
      if (!derived.ok) return <RawCard store={store} view={view} />
      return (
        <PeraAssetCard
          data={derived.model}
          network={derived.model.network}
          onOpen={onOpen ? (assetId) => onOpen({ kind: 'asset', assetId }) : undefined}
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
          onOpen={
            onOpen ? (applicationId) => onOpen({ kind: 'application', applicationId }) : undefined
          }
        />
      )
    }
    case 'application.state': {
      const derived = createApplicationStateViewModel(store, view)
      return derived.ok ? (
        <ApplicationStateCard {...derived.model} />
      ) : (
        <RawCard store={store} view={view} />
      )
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
          onOpen={
            onOpen ? (applicationId) => onOpen({ kind: 'application', applicationId }) : undefined
          }
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
      return derived.ok ? (
        <ApplicationBoxCard {...derived.model} />
      ) : (
        <RawCard store={store} view={view} />
      )
    }
    case 'application.boxes': {
      const derived = createApplicationBoxesViewModel(store, view)
      return derived.ok ? (
        <ApplicationBoxesCard {...derived.model} />
      ) : (
        <RawCard store={store} view={view} />
      )
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
