/** The direct lane: entity lookups by id that bypass the model, each landing as a card in the feed. */
import {
  loadNextPage as loadNextPageRecord,
  type TransactionSearchFilter,
  addResult,
  createAccountListViewModel,
  createAccountPortfolioViewModel,
  createApplicationDetailViewModel,
  createAssetDetailViewModel,
  createBlockDetailViewModel,
  createTransactionCollectionViewModel,
  createTransactionDetailViewModel,
  formatMicroAlgos,
  lookupAmbiguousEntity,
  EXPLORER_PROTOCOL_VERSION,
  type ResultStore,
  type StructuredResult,
  type TrustedViewId,
  type ViewSpec,
} from '@initlabs/vibekit-explorer'
import type { LiveNetworkId } from '@initlabs/vibekit-explorer/live'
import { nfdPlugin, nfdRecord, type NfdService } from '@initlabs/vibekit/plugins/nfd'
import { useCallback, useRef } from 'react'

import { withAccountNames } from './features/network/keystore-host.js'
import { errorMessage, shorten } from './theme.js'
import type { Feed } from './feed/hooks.js'
import { enrichResultWithAbi } from './features/apps/abi-catalog.js'
import type { ExplorerHost } from './features/network/hooks.js'
import type { NormalizedAppSpec } from '@initlabs/vibekit/tools'

/**
 * Fetches the page after `view`'s record — the record's own call with its
 * nextToken, through the host — and returns a view over the merged record,
 * or undefined when the record is final. Any paged list, any tool.
 */
export async function loadNextPage(args: {
  host: ExplorerHost
  storeRef: { current: ResultStore }
  commitStore: (next: ResultStore) => void
  network: string
  view: ViewSpec
}): Promise<ViewSpec | undefined> {
  const merged = await loadNextPageRecord({
    host: args.host,
    current: args.storeRef.current.find((record) => record.resultId === args.view.source.id),
    view: args.view.view,
    identity: {
      resultId: `result-page-${crypto.randomUUID()}`,
      toolCallId: `tool-call-page-${crypto.randomUUID()}`,
      network: args.network,
    },
  })
  if (!merged) return undefined
  args.commitStore(addResult(args.storeRef.current, merged))
  return viewFor(merged, args.view.view)
}

/** Wraps a stored record in a trusted view spec. */
export function viewFor(record: StructuredResult, view: TrustedViewId): ViewSpec {
  return {
    protocolVersion: EXPLORER_PROTOCOL_VERSION,
    type: 'view',
    view,
    source: { source: 'result', id: record.resultId },
  } as ViewSpec
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/** Direct-lane entity lookups: ids and addresses typed or pasted into the composer. */
export function useLookups({
  feed,
  host,
  accountList,
  commitStore,
  storeRef,
  networkRef,
  busyRef,
  setBusy,
  setStatus,
  specCatalog,
  disabledPlugins,
}: {
  feed: Feed
  host: () => ExplorerHost
  /** The keystore address book, or the sample one when no daemon answers. */
  accountList: ReadonlyArray<{ address: string; name?: string }>
  commitStore: (next: ResultStore) => void
  storeRef: { current: ResultStore }
  networkRef: { current: LiveNetworkId }
  busyRef: { current: boolean }
  setBusy: (busy: boolean) => void
  setStatus: (status: string) => void
  specCatalog: ReadonlyMap<number, NormalizedAppSpec>
  /** Plugins the user turned off; name.algo lookups need nfd. */
  disabledPlugins: ReadonlySet<string>
}) {
  const { appendBlock, appendNote } = feed

  /** The busy/status/error dance around one request; a request while busy says so. */
  const withBusy = useCallback(
    (
      sectionId: number,
      status: string,
      failure: string,
      task: () => Promise<void>,
    ): Promise<void> => {
      if (busyRef.current) {
        appendNote(sectionId, 'Still working on the last request.', 'error')
        return Promise.resolve()
      }
      setBusy(true)
      setStatus(status)
      return task()
        .catch((error: unknown) =>
          appendNote(sectionId, `${failure} — ${errorMessage(error)}`, 'error'),
        )
        .finally(() => {
          setBusy(false)
          setStatus('')
        })
    },
    [appendNote, busyRef, setBusy, setStatus],
  )

  /** Stores a record and appends its card; returns the view spec the card renders. */
  const presentRecord = useCallback(
    (sectionId: number, record: StructuredResult, view: TrustedViewId): ViewSpec => {
      const enriched = enrichResultWithAbi(record, specCatalog)
      commitStore(addResult(storeRef.current, enriched))
      const spec = viewFor(enriched, view)
      appendBlock(sectionId, { kind: 'view', view: spec })
      return spec
    },
    [appendBlock, commitStore, specCatalog, storeRef],
  )

  /** One lookup: fetch, present as `view`, then a one-line summary note. `run` may return nothing. */
  const lookupById = useCallback(
    (
      sectionId: number,
      lookup: {
        label: string
        view: TrustedViewId
        run: () => Promise<StructuredResult | undefined>
        summary?: (record: StructuredResult, view: ViewSpec) => string | undefined
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
          const line = lookup.summary?.(record, view)
          if (line) appendNote(sectionId, line)
        },
      ),
    [appendNote, presentRecord, withBusy],
  )

  const openTransaction = useCallback(
    (sectionId: number, txid: string) =>
      lookupById(sectionId, {
        label: txid.slice(0, 8),
        view: 'transaction.detail',
        failure: "Couldn't find that transaction",
        run: () => host().lookupTransaction(txid),
        summary: (_record, view) => {
          const derived = createTransactionDetailViewModel(storeRef.current, view)
          return derived.ok && derived.model.paymentAmountMicroAlgos !== undefined
            ? `${formatMicroAlgos(derived.model.paymentAmountMicroAlgos)} ALGO from ${shorten(derived.model.sender, 12)} to ${shorten(derived.model.receiver ?? '—', 12)}, ${derived.model.status}.`
            : undefined
        },
      }),
    [host, lookupById, storeRef],
  )

  const openAccount = useCallback(
    (sectionId: number, address: string) =>
      lookupById(sectionId, {
        label: address.slice(0, 8),
        view: 'account.portfolio',
        failure: "Couldn't open the account",
        run: () => host().lookupAccount(address),
        summary: (_record, view) => {
          const derived = createAccountPortfolioViewModel(storeRef.current, view)
          return derived.ok
            ? `Holds ${formatMicroAlgos(derived.model.balanceMicroAlgos)} ALGO and ${plural(derived.model.assets.length, 'asset')}.`
            : undefined
        },
      }),
    [host, lookupById, storeRef],
  )

  // The NFD plugin's service is its client cache; built lazily on first name.
  const nfdRef = useRef<NfdService | null>(null)

  const openAccountName = useCallback(
    (sectionId: number, name: string) => {
      const network = networkRef.current
      if (disabledPlugins.has('nfd')) {
        appendNote(
          sectionId,
          'The nfd plugin is off — turn it on (plugins ^5) to resolve names, or paste an address.',
          'error',
        )
        return
      }
      if (network !== 'mainnet' && network !== 'testnet') {
        appendNote(
          sectionId,
          `NFD names resolve on mainnet and testnet only — you're on ${network}. Paste an address instead.`,
          'error',
        )
        return
      }
      let address: string | undefined
      void withBusy(sectionId, `resolving ${name}…`, `Couldn't resolve ${name}`, async () => {
        nfdRef.current ??= nfdPlugin().service as NfdService
        const nfd = await nfdRef.current.clientFor(network).resolve(name, { view: 'full' })
        const data = nfdRecord(nfd, name)
        if (!data.address) throw new Error('the name has no deposit address')
        appendBlock(sectionId, { kind: 'plugin', view: 'nfd.profile', data, network })
        address = data.address
      }).then(() => {
        // Its own lookup, after the resolve has released busy: from here the
        // name behaves exactly like a pasted address.
        if (address) void openAccount(sectionId, address)
      })
    },
    [appendBlock, appendNote, disabledPlugins, networkRef, openAccount, withBusy],
  )

  const openMyAccounts = useCallback(
    (sectionId: number) =>
      lookupById(sectionId, {
        label: 'your accounts',
        view: 'account.list',
        failure: "Couldn't list accounts",
        run: async () => {
          const accounts = accountList
          if (accounts.length === 0) {
            appendNote(
              sectionId,
              'No keystore accounts yet. Start the daemon, or paste an address.',
            )
            return undefined
          }
          return withAccountNames(
            await host().lookupAccounts(accounts.map((account) => account.address)),
            accounts,
          )
        },
        summary: (_record, view) => {
          const derived = createAccountListViewModel(storeRef.current, view)
          return derived.ok
            ? `${plural(derived.model.accounts.length, 'account')} on ${networkRef.current}.`
            : undefined
        },
      }),
    [accountList, appendNote, host, lookupById, networkRef, storeRef],
  )

  const openAsset = useCallback(
    (sectionId: number, assetId: number) =>
      lookupById(sectionId, {
        label: `asset ${assetId}`,
        view: 'asset.detail',
        run: () => host().lookupAsset(assetId),
        summary: (_record, view) => {
          const derived = createAssetDetailViewModel(storeRef.current, view)
          return derived.ok
            ? `${derived.model.name ?? 'Asset'} · ${derived.model.decimals} decimals · supply ${derived.model.totalSupply}.`
            : undefined
        },
      }),
    [host, lookupById, storeRef],
  )

  /** An account's asset holdings as their own paged list (the portfolio card shows the first few). */
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
        summary: (_record, view) => {
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
        summary: (_record, view) => {
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
        summary: (_record, view) => {
          const derived = createBlockDetailViewModel(storeRef.current, view)
          return derived.ok
            ? `Round ${derived.model.round} · ${plural(derived.model.transactionCount, 'transaction')}.`
            : undefined
        },
      }),
    [host, lookupById, storeRef],
  )

  /** Transactions scoped to one entity (a card's "transactions ▸"). */
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
        summary: (_record, view) => {
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
      if (!Number.isSafeInteger(id)) return
      void withBusy(
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

  return {
    openTransaction,
    openAccount,
    openAccountName,
    openMyAccounts,
    openHoldings,
    openAsset,
    openApplication,
    openGroup,
    openBlock,
    openTransactions,
    openAmbiguous,
  }
}
