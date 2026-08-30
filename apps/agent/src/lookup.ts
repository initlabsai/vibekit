/** The direct lane: entity lookups by id that need no model, each landing as a card in the feed. */
import {
  isPluginViewId,
  type JsonValue,
  buildPluginRecord,
  type NfdRecord,
  addResult,
  createAccountListViewModel,
  createAccountPortfolioViewModel,
  createApplicationDetailViewModel,
  createAssetDetailViewModel,
  createBlockDetailViewModel,
  createTransactionCollectionViewModel,
  createTransactionDetailViewModel,
  RECORD_PROTOCOL_VERSION,
  formatMicroAlgos,
  lookupAmbiguousEntity,
  type LiveNetworkId,
  type ResultStore,
  type StructuredResult,
  type TransactionSearchFilter,
  type TrustedViewId,
  type ViewSpec,
} from '@initlabs/vibekit/views'
import { useCallback, useState } from 'react'

import type { PriceRange, WalletAccount } from './commands'
import type { Feed } from './feed/hooks'
import type { ExplorerHost } from './features/network/hooks'
import type { RemoteExplorerHost } from './remote-host'
import { nextPageOf } from './paging'
import { errorMessage, shorten } from './theme'

/** Wraps a stored record in a trusted view spec. */
export function viewFor(record: StructuredResult, view: TrustedViewId): ViewSpec {
  return {
    protocolVersion: RECORD_PROTOCOL_VERSION,
    type: 'view',
    view,
    source: { source: 'result', id: record.resultId },
  } as ViewSpec
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function useLookups({
  feed,
  host,
  remoteHost,
  live,
  accounts,
  commitStore,
  storeRef,
  networkRef,
  busyRef,
  setBusy,
  setStatus,
}: {
  feed: Feed
  host: () => ExplorerHost
  /** Names resolve through the route even when reads fall back to sample data. */
  remoteHost: RemoteExplorerHost
  live: 'probing' | boolean
  /** The connected wallet's accounts; empty until one connects. */
  accounts: ReadonlyArray<WalletAccount>
  commitStore: (next: ResultStore) => void
  storeRef: { current: ResultStore }
  networkRef: { current: LiveNetworkId }
  busyRef: { current: boolean }
  setBusy: (busy: boolean) => void
  setStatus: (status: string) => void
}) {
  const { appendBlock, appendNote, replaceBlockView } = feed
  const [loadingMore, setLoadingMore] = useState<number | null>(null)

  /** The busy/status/error dance around one request; a request while busy says so. */
  const withBusy = useCallback(
    (sectionId: number, status: string, failure: string, task: () => Promise<void>) => {
      if (busyRef.current) {
        appendNote(sectionId, 'Still working on the last request.', 'error')
        return Promise.resolve()
      }
      setBusy(true)
      setStatus(
        live === true ? status : `${status} (sample data — ${networkRef.current} is unreachable)`,
      )
      return task()
        .catch((error: unknown) =>
          appendNote(
            sectionId,
            `${failure} — ${errorMessage(error)}${live === true ? '' : ` Switch to testnet or mainnet for live data.`}`,
            'error',
          ),
        )
        .finally(() => {
          setBusy(false)
          setStatus('')
        })
    },
    [appendNote, busyRef, live, networkRef, setBusy, setStatus],
  )

  const presentRecord = useCallback(
    (sectionId: number, record: StructuredResult, view: TrustedViewId): ViewSpec => {
      commitStore(addResult(storeRef.current, record))
      const spec = viewFor(record, view)
      appendBlock(sectionId, { kind: 'view', view: spec })
      return spec
    },
    [appendBlock, commitStore, storeRef],
  )

  const lookupById = useCallback(
    (
      sectionId: number,
      lookup: {
        label: string
        view: TrustedViewId
        run: () => Promise<StructuredResult | undefined>
        summary?: (view: ViewSpec) => string | undefined
        failure?: string
      },
    ) =>
      withBusy(
        sectionId,
        `looking up ${lookup.label}…`,
        lookup.failure ?? `Couldn't open ${lookup.label}`,
        async () => {
          const record = await lookup.run()
          if (!record) return
          const view = presentRecord(sectionId, record, lookup.view)
          const line = lookup.summary?.(view)
          if (line) appendNote(sectionId, line)
        },
      ),
    [appendNote, presentRecord, withBusy],
  )

  const openTransaction = useCallback(
    (sectionId: number, txid: string) =>
      txid === ''
        ? (appendNote(sectionId, 'That row has no transaction id of its own.', 'error'),
          Promise.resolve())
        : lookupById(sectionId, {
            label: txid.slice(0, 8),
            view: 'transaction.detail',
            failure: "Couldn't find that transaction",
            run: () => host().lookupTransaction(txid),
            summary: (view) => {
              const derived = createTransactionDetailViewModel(storeRef.current, view)
              return derived.ok && derived.model.paymentAmountMicroAlgos !== undefined
                ? `${formatMicroAlgos(derived.model.paymentAmountMicroAlgos)} ALGO from ${shorten(derived.model.sender, 12)} to ${shorten(derived.model.receiver ?? '—', 12)}, ${derived.model.status}.`
                : undefined
            },
          }),
    [appendNote, host, lookupById, storeRef],
  )

  const openAccount = useCallback(
    (sectionId: number, address: string) =>
      lookupById(sectionId, {
        label: address.slice(0, 8),
        view: 'account.portfolio',
        failure: "Couldn't open the account",
        run: () => host().lookupAccount(address),
        summary: (view) => {
          const derived = createAccountPortfolioViewModel(storeRef.current, view)
          return derived.ok
            ? `Holds ${formatMicroAlgos(derived.model.balanceMicroAlgos)} ALGO and ${plural(derived.model.assets.length, 'asset')}.`
            : undefined
        },
      }),
    [appendNote, host, lookupById, storeRef],
  )

  const openAccountName = useCallback(
    (sectionId: number, name: string) => {
      const network = networkRef.current
      if (network !== 'mainnet' && network !== 'testnet') {
        appendNote(
          sectionId,
          `NFD names resolve on mainnet and testnet only — you're on ${network}. Paste an address instead.`,
          'error',
        )
        return Promise.resolve()
      }
      let address: string | undefined
      return withBusy(sectionId, `resolving ${name}…`, `Couldn't resolve ${name}`, async () => {
        const record = buildPluginRecord(
          'nfd.profile',
          {
            resultId: `result-nfd-${crypto.randomUUID()}`,
            toolCallId: `tool-call-nfd-${crypto.randomUUID()}`,
            network,
          },
          await remoteHost.resolveName(name),
          'resolve_nfd',
        )
        const data = record.state === 'success' ? (record.data as NfdRecord) : undefined
        if (!data?.address) throw new Error('the name has no deposit address')
        presentRecord(sectionId, record, 'nfd.profile')
        address = data.address
      }).then(() => {
        // Its own lookup, after the resolve has released busy: from here the
        // name behaves exactly like a pasted address.
        if (address) return openAccount(sectionId, address)
      })
    },
    [appendNote, networkRef, openAccount, presentRecord, remoteHost, withBusy],
  )

  /** A plugin read from the direct lane: Vestige candles become the price card. */
  const openPriceHistory = useCallback(
    (sectionId: number, assetId: number, range?: PriceRange) => {
      const network = networkRef.current
      if (network !== 'mainnet') {
        appendNote(
          sectionId,
          `Prices come from Vestige on mainnet — you're on ${network}.`,
          'error',
        )
        return Promise.resolve()
      }
      return withBusy(
        sectionId,
        `charting ${assetId === 0 ? 'ALGO' : `asset ${assetId}`}…`,
        "Couldn't load the price history",
        async () => {
          const wire = await remoteHost.pluginTool('get_asset_price_history', {
            assetId,
            ...(range ? { range } : {}),
          })
          const record = buildPluginRecord(
            'vestige.history',
            {
              resultId: `result-price-${crypto.randomUUID()}`,
              toolCallId: `tool-call-price-${crypto.randomUUID()}`,
              network,
            },
            wire,
            'get_asset_price_history',
          )
          presentRecord(sectionId, record, 'vestige.history')
        },
      )
    },
    [appendNote, networkRef, presentRecord, remoteHost, withBusy],
  )

  const openMyAccounts = useCallback(
    (sectionId: number) =>
      lookupById(sectionId, {
        label: 'your accounts',
        view: 'account.list',
        failure: "Couldn't list accounts",
        run: async () => {
          if (accounts.length === 0) {
            appendNote(sectionId, 'No wallet connected — connect one, or paste an address.')
            return undefined
          }
          return host().lookupAccounts(accounts.map((account) => account.address))
        },
        summary: (view) => {
          const derived = createAccountListViewModel(storeRef.current, view)
          return derived.ok
            ? `${plural(derived.model.accounts.length, 'account')} on ${networkRef.current}.`
            : undefined
        },
      }),
    [accounts, appendNote, host, lookupById, networkRef, storeRef],
  )

  const openAsset = useCallback(
    (sectionId: number, assetId: number) =>
      lookupById(sectionId, {
        label: `asset ${assetId}`,
        view: 'asset.detail',
        run: () => host().lookupAsset(assetId),
        summary: (view) => {
          const derived = createAssetDetailViewModel(storeRef.current, view)
          return derived.ok
            ? `${derived.model.name ?? 'Asset'} · ${derived.model.decimals} decimals · supply ${derived.model.totalSupply}.`
            : undefined
        },
      }),
    [host, lookupById, storeRef],
  )

  const openHoldings = useCallback(
    (sectionId: number, address: string) =>
      lookupById(sectionId, {
        label: `assets of ${address.slice(0, 8)}…`,
        view: 'asset.holdings',
        run: () => host().lookupAccountAssets(address),
      }),
    [host, lookupById],
  )

  const openApplication = useCallback(
    (sectionId: number, applicationId: number) =>
      lookupById(sectionId, {
        label: `application ${applicationId}`,
        view: 'application.detail',
        run: () => host().lookupApplication(applicationId),
        summary: (view) => {
          const derived = createApplicationDetailViewModel(storeRef.current, view)
          return derived.ok
            ? `App ${derived.model.applicationId} · ${plural(derived.model.globalStateCount, 'global state key')}.`
            : undefined
        },
      }),
    [host, lookupById, storeRef],
  )

  const openGroup = useCallback(
    (sectionId: number, groupId: string) =>
      lookupById(sectionId, {
        label: `group ${groupId.slice(0, 8)}…`,
        view: 'transaction.group',
        run: () => host().lookupTransactionGroup(groupId),
        summary: (view) => {
          const derived = createTransactionCollectionViewModel(storeRef.current, view)
          return derived.ok
            ? `${plural(derived.model.transactions.length, 'transaction')} in the group.`
            : undefined
        },
      }),
    [host, lookupById, storeRef],
  )

  const openBlock = useCallback(
    (sectionId: number, round: number) =>
      lookupById(sectionId, {
        label: `block ${round}`,
        view: 'block.detail',
        run: () => host().lookupBlock(round),
        summary: (view) => {
          const derived = createBlockDetailViewModel(storeRef.current, view)
          return derived.ok
            ? `Round ${derived.model.round} · ${plural(derived.model.transactionCount, 'transaction')}.`
            : undefined
        },
      }),
    [host, lookupById, storeRef],
  )

  const openNetworkStatus = useCallback(
    (sectionId: number) =>
      lookupById(sectionId, {
        label: 'network status',
        view: 'network.status',
        run: () => host().callTool('get_network_status', {}),
      }),
    [host, lookupById],
  )

  const openTransactions = useCallback(
    (sectionId: number, filter: TransactionSearchFilter) => {
      const label = filter.address
        ? `transactions of ${filter.address.slice(0, 8)}…`
        : filter.assetId !== undefined
          ? `transactions of asset ${filter.assetId}`
          : filter.applicationId !== undefined
            ? `transactions of app ${filter.applicationId}`
            : `transactions in round ${filter.round}`
      return lookupById(sectionId, {
        label,
        view: 'transaction.list',
        run: () => host().searchTransactions(filter),
        summary: (view) => {
          const derived = createTransactionCollectionViewModel(storeRef.current, view)
          return derived.ok
            ? `${plural(derived.model.transactions.length, 'transaction')}${derived.model.nextToken ? ', more available' : ''}.`
            : undefined
        },
      })
    },
    [host, lookupById, storeRef],
  )

  const openAmbiguous = useCallback(
    (sectionId: number, raw: string) => {
      const id = Number(raw)
      if (!Number.isSafeInteger(id)) return Promise.resolve()
      return withBusy(
        sectionId,
        `looking up ${raw} as asset, application, and block…`,
        `Couldn't look up ${raw}`,
        async () => {
          const outcome = await lookupAmbiguousEntity(host(), id)
          for (const match of outcome.matches) {
            const view: TrustedViewId =
              match.entity === 'asset'
                ? 'asset.detail'
                : match.entity === 'application'
                  ? 'application.detail'
                  : 'block.detail'
            presentRecord(sectionId, match.record, view)
          }
          if (outcome.matches.length === 0) {
            appendNote(
              sectionId,
              `No asset, application, or block ${raw} on ${networkRef.current}.`,
              'error',
            )
            return
          }
          if (outcome.misses.length > 0) {
            appendNote(
              sectionId,
              `Also checked: ${outcome.misses.map((miss) => miss.entity).join(', ')} — no match.`,
            )
          }
        },
      )
    },
    [appendNote, host, networkRef, presentRecord, withBusy],
  )

  /** Re-runs a plugin read with new arguments and swaps the result into the same card (a chart's range chips). */
  const rerunPlugin = useCallback(
    (
      sectionId: number,
      itemId: number,
      view: ViewSpec,
      toolName: string,
      args: Record<string, unknown>,
    ) => {
      if (loadingMore !== null) return
      const viewId = view.view
      if (!isPluginViewId(viewId)) return
      setLoadingMore(itemId)
      const network = networkRef.current
      remoteHost
        .pluginTool(toolName, args)
        .then((wire) => {
          const record = buildPluginRecord(
            viewId,
            {
              resultId: `result-rerun-${crypto.randomUUID()}`,
              toolCallId: `tool-call-rerun-${crypto.randomUUID()}`,
              network,
              input: args as JsonValue,
            },
            wire,
            toolName,
          )
          commitStore(addResult(storeRef.current, record))
          replaceBlockView(sectionId, itemId, viewFor(record, viewId))
        })
        .catch((error: unknown) =>
          appendNote(sectionId, `Couldn't reload — ${errorMessage(error)}`, 'error'),
        )
        .finally(() => setLoadingMore(null))
    },
    [appendNote, commitStore, loadingMore, networkRef, remoteHost, replaceBlockView, storeRef],
  )

  /** Fetches the next page of a list card into the same card. */
  const loadMore = useCallback(
    (sectionId: number, itemId: number, view: ViewSpec) => {
      if (loadingMore !== null) return
      setLoadingMore(itemId)
      nextPageOf({ host: host(), store: storeRef.current, view, network: networkRef.current })
        .then((merged) => {
          if (!merged) return
          commitStore(addResult(storeRef.current, merged))
          replaceBlockView(sectionId, itemId, viewFor(merged, view.view))
        })
        .catch((error: unknown) =>
          appendNote(sectionId, `Couldn't load more — ${errorMessage(error)}`, 'error'),
        )
        .finally(() => setLoadingMore(null))
    },
    [appendNote, commitStore, host, loadingMore, networkRef, replaceBlockView, storeRef],
  )

  return {
    loadMore,
    rerunPlugin,
    loadingMore,
    openTransaction,
    openAccount,
    openAccountName,
    openMyAccounts,
    openPriceHistory,
    openHoldings,
    openAsset,
    openApplication,
    openGroup,
    openBlock,
    openNetworkStatus,
    openTransactions,
    openAmbiguous,
  }
}
