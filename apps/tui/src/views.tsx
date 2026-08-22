import {
  createAccountListViewModel,
  createAccountPortfolioViewModel,
  createAccountSummaryViewModel,
  createApplicationBoxViewModel,
  createApplicationDetailViewModel,
  createApplicationListViewModel,
  createApplicationLocalsViewModel,
  createApplicationLogsViewModel,
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
  type ResultStore,
  type ViewSpec,
} from '@initlabs/vibekit-experience'

import {
  AccountCard,
  AccountListCard,
  buildGroupGraph,
  AccountSummaryCard,
  ApplicationBoxCard,
  ApplicationCard,
  ApplicationListCard,
  ApplicationLocalsCard,
  ApplicationLogsCard,
  ApplicationStateCard,
  AssetCard,
  AssetHoldersCard,
  AssetHoldingsCard,
  AssetListCard,
  BlockCard,
  BlockListCard,
  NetworkCard,
  RawCard,
  TransactionCard,
  TransactionGraphCard,
  TransactionListCard,
  Unavailable,
  type AssetSort,
} from './cards/index.js'

export { RawCard }

/** Renders one trusted view as a TUI card. */
export function ResultView({
  store,
  view,
  width,
  sort = 'none',
  maxAssets = 20,
  flow = 'graph',
}: {
  store: ResultStore
  view: ViewSpec
  width: number
  sort?: AssetSort
  maxAssets?: number
  /** transaction.group presentation: flow graph (primary) or the row table. */
  flow?: 'graph' | 'table'
}) {
  switch (view.view) {
    case 'transaction.detail': {
      const derived = createTransactionDetailViewModel(store, view)
      if (!derived.ok) return <TransactionCard model={undefined} width={width} />
      const { amountMicroAlgos, ...model } = derived.model
      // Every detail gets the flow graph a group does (inner txns included).
      const graph = buildGroupGraph([{ ...model, paymentAmountMicroAlgos: amountMicroAlgos }])
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
          maxAssets={maxAssets}
        />
      )
    }
    case 'asset.detail': {
      const derived = createAssetDetailViewModel(store, view)
      return <AssetCard model={derived.ok ? derived.model : undefined} width={width} />
    }
    case 'application.detail': {
      const derived = createApplicationDetailViewModel(store, view)
      return <ApplicationCard model={derived.ok ? derived.model : undefined} width={width} />
    }
    case 'block.detail': {
      const derived = createBlockDetailViewModel(store, view)
      return <BlockCard model={derived.ok ? derived.model : undefined} width={width} />
    }
    case 'network.status': {
      const derived = createNetworkStatusViewModel(store, view)
      return <NetworkCard model={derived.ok ? derived.model : undefined} width={width} />
    }
    case 'account.summary': {
      const derived = createAccountSummaryViewModel(store, view)
      if (!derived.ok) return <Unavailable title="ACCOUNT" width={width} />
      const model = derived.model
      return (
        <AccountSummaryCard
          address={model.address}
          name={model.name}
          network={model.network}
          status={model.status}
          balanceMicroAlgos={model.balanceMicroAlgos}
          totalAssetsOptedIn={model.totalAssetsOptedIn}
          totalAppsOptedIn={model.totalAppsOptedIn}
          totalCreatedAssets={model.totalCreatedAssets}
          totalCreatedApps={model.totalCreatedApps}
          createdAtRound={model.createdAtRound}
          minBalanceMicroAlgos={model.minBalanceMicroAlgos}
          rekeyedTo={model.rekeyedTo}
          width={width}
        />
      )
    }
    case 'account.list': {
      const derived = createAccountListViewModel(store, view)
      if (!derived.ok) return <Unavailable title="ACCOUNTS" width={width} />
      return (
        <AccountListCard
          accounts={derived.model.accounts}
          nextToken={derived.model.nextToken}
          width={width}
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
          width={width}
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
          width={width}
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
          width={width}
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
          width={width}
        />
      )
    }
    case 'application.state': {
      const derived = createApplicationStateViewModel(store, view)
      if (!derived.ok) return <Unavailable title="APP STATE" width={width} />
      return (
        <ApplicationStateCard
          applicationId={derived.model.applicationId}
          scope={derived.model.scope}
          address={derived.model.address}
          optedIn={derived.model.optedIn}
          entries={derived.model.entries}
          width={width}
        />
      )
    }
    case 'application.locals': {
      const derived = createApplicationLocalsViewModel(store, view)
      if (!derived.ok) return <Unavailable title="APP LOCALS" width={width} />
      return (
        <ApplicationLocalsCard
          address={derived.model.address}
          apps={derived.model.apps}
          nextToken={derived.model.nextToken}
          width={width}
        />
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
          width={width}
        />
      )
    }
    case 'application.box': {
      const derived = createApplicationBoxViewModel(store, view)
      if (!derived.ok) return <Unavailable title="APP BOX" width={width} />
      const model = derived.model
      return (
        <ApplicationBoxCard
          applicationId={model.applicationId}
          boxName={model.boxName}
          exists={model.exists}
          value={model.value}
          size={model.size}
          width={width}
        />
      )
    }
    case 'block.list': {
      const derived = createBlockListViewModel(store, view)
      if (!derived.ok) return <Unavailable title="BLOCKS" width={width} />
      return (
        <BlockListCard
          blocks={derived.model.blocks}
          nextToken={derived.model.nextToken}
          width={width}
        />
      )
    }
  }
}
