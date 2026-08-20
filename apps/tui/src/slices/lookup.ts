import {
  addResult,
  createAccountListViewModel,
  createAccountPortfolioViewModel,
  createApplicationDetailViewModel,
  createAssetDetailViewModel,
  createBlockDetailViewModel,
  createTransactionCollectionViewModel,
  createTransactionDetailViewModel,
  formatMicroAlgos,
  FIXTURE_ADDRESS_BOOK,
  lookupAmbiguousEntity,
  EXPERIENCE_PROTOCOL_VERSION,
  type ResultStore,
  type StructuredResult,
  type TrustedViewId,
  type ViewSpec,
} from '@initlabs/vibekit-experience'
import type { LiveNetworkId } from '@initlabs/vibekit-experience/live'
import { nfdPlugin, type NfdService } from '@initlabs/vibekit-plugin-nfd'
import { useCallback, useRef } from 'react'

import type { WorkspaceScreen } from '../chrome.js'
import type { KeystorePaymentHost } from '../keystore-host.js'
import { shorten } from '../theme.js'
import type { Feed } from './feed.js'
import type { ExplorerHost } from './network.js'

/** Wraps a stored record in a trusted view spec. */
export function viewFor(record: StructuredResult, view: TrustedViewId): ViewSpec {
  return {
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'view',
    view,
    source: { source: 'result', id: record.resultId },
  } as ViewSpec
}

/** Direct-lane entity lookups: ids and addresses typed or pasted into the composer. */
export function useLookups({
  feed,
  host,
  keystoreHost,
  signerReady,
  commitStore,
  storeRef,
  networkRef,
  busy,
  setBusy,
  setStatus,
  setScreen,
}: {
  feed: Feed
  host: () => ExplorerHost
  keystoreHost: KeystorePaymentHost
  signerReady: boolean
  commitStore: (next: ResultStore) => void
  storeRef: { current: ResultStore }
  networkRef: { current: LiveNetworkId }
  busy: boolean
  setBusy: (busy: boolean) => void
  setStatus: (status: string) => void
  setScreen: (screen: WorkspaceScreen) => void
}) {
  const { appendBlock, appendNote } = feed

  const openTransaction = useCallback(
    (sectionId: number, txid: string) => {
      if (busy) return
      setBusy(true)
      setStatus(`looking up ${txid.slice(0, 8)}…`)
      void host()
        .lookupTransaction(txid)
        .then((record) => {
          setBusy(false)
          setStatus('')
          const nextStore = addResult(storeRef.current, record)
          commitStore(nextStore)
          const view = viewFor(record, 'transaction.detail')
          appendBlock(sectionId, { id: 0, kind: 'view', view })
          const derived = createTransactionDetailViewModel(nextStore, view)
          const summary =
            derived.ok && derived.model.amountMicroAlgos !== undefined
              ? `${formatMicroAlgos(derived.model.amountMicroAlgos)} ALGO from ${shorten(derived.model.sender, 12)} to ${shorten(derived.model.receiver ?? '—', 12)}, ${derived.model.status}.`
              : undefined
          if (summary) appendNote(sectionId, summary)
        })
        .catch((error: unknown) => {
          setBusy(false)
          setStatus('')
          appendNote(
            sectionId,
            `Couldn't find that transaction — ${error instanceof Error ? error.message : String(error)}`,
            'error',
          )
        })
    },
    [appendBlock, appendNote, busy, commitStore, host, setBusy, setStatus, storeRef],
  )

  const openAccount = useCallback(
    (sectionId: number, address: string) => {
      if (busy) return
      setBusy(true)
      setStatus(`looking up ${address.slice(0, 8)}…`)
      void host()
        .lookupAccount(address)
        .then((record) => {
          setBusy(false)
          setStatus('')
          const nextStore = addResult(storeRef.current, record)
          commitStore(nextStore)
          const view = viewFor(record, 'account.portfolio')
          appendBlock(sectionId, { id: 0, kind: 'view', view })
          const derived = createAccountPortfolioViewModel(nextStore, view)
          if (derived.ok) {
            appendNote(
              sectionId,
              `Holds ${formatMicroAlgos(derived.model.balanceMicroAlgos)} ALGO and ${derived.model.assets.length} asset${derived.model.assets.length === 1 ? '' : 's'}.`,
            )
          }
          setScreen('chat')
        })
        .catch((error: unknown) => {
          setBusy(false)
          setStatus('')
          appendNote(
            sectionId,
            `Couldn't open the account — ${error instanceof Error ? error.message : String(error)}`,
            'error',
          )
          setScreen('chat')
        })
    },
    [appendBlock, appendNote, busy, commitStore, host, setBusy, setScreen, setStatus, storeRef],
  )

  // The NFD plugin's service is its client cache; built lazily on first name.
  const nfdRef = useRef<NfdService | null>(null)

  const openAccountName = useCallback(
    (sectionId: number, name: string) => {
      if (busy) return
      const network = networkRef.current
      if (network !== 'mainnet' && network !== 'testnet') {
        appendNote(
          sectionId,
          `NFD names resolve on mainnet and testnet only — you're on ${network}. Paste an address instead.`,
          'error',
        )
        return
      }
      setBusy(true)
      setStatus(`resolving ${name}…`)
      const openResolved = openAccount
      void Promise.resolve()
        .then(() => {
          nfdRef.current ??= nfdPlugin().service as NfdService
          return nfdRef.current.clientFor(network).resolve(name)
        })
        .then((nfd) => {
          const address = nfd.depositAccount ?? nfd.owner
          if (!address) throw new Error('the name has no deposit address')
          setBusy(false)
          setStatus('')
          appendNote(sectionId, `${name} → ${shorten(address, 20)}`)
          // From here the name behaves exactly like a pasted address.
          openResolved(sectionId, address)
        })
        .catch((error: unknown) => {
          setBusy(false)
          setStatus('')
          appendNote(
            sectionId,
            `Couldn't resolve ${name} — ${error instanceof Error ? error.message : String(error)}`,
            'error',
          )
        })
    },
    [appendNote, busy, networkRef, openAccount, setBusy, setStatus],
  )

  const presentRecord = useCallback(
    (sectionId: number, record: StructuredResult, view: TrustedViewId) => {
      commitStore(addResult(storeRef.current, record))
      appendBlock(sectionId, { id: 0, kind: 'view', view: viewFor(record, view) })
    },
    [appendBlock, commitStore, storeRef],
  )

  const openMyAccounts = useCallback(
    (sectionId: number) => {
      if (busy) return
      setBusy(true)
      setStatus('looking up your accounts…')
      const source = signerReady
        ? keystoreHost.listSigningAccounts()
        : Promise.resolve([...FIXTURE_ADDRESS_BOOK])
      void source
        .then(async (accounts) => {
          if (accounts.length === 0) {
            setBusy(false)
            setStatus('')
            appendNote(
              sectionId,
              'No keystore accounts yet. Start the daemon, or paste an address.',
            )
            return
          }
          const record = await host().lookupAccounts(accounts.map((account) => account.address))
          setBusy(false)
          setStatus('')
          presentRecord(sectionId, record, 'account.list')
          const derived = createAccountListViewModel(
            storeRef.current,
            viewFor(record, 'account.list'),
          )
          if (derived.ok) {
            appendNote(
              sectionId,
              `${derived.model.accounts.length} account${derived.model.accounts.length === 1 ? '' : 's'} on ${networkRef.current}.`,
            )
          }
        })
        .catch((error: unknown) => {
          setBusy(false)
          setStatus('')
          appendNote(
            sectionId,
            `Couldn't list accounts — ${error instanceof Error ? error.message : String(error)}`,
            'error',
          )
        })
    },
    [appendNote, busy, host, keystoreHost, networkRef, presentRecord, setBusy, setStatus, signerReady, storeRef],
  )

  const lookupById = useCallback(
    (
      sectionId: number,
      label: string,
      view: TrustedViewId,
      run: () => Promise<StructuredResult>,
      summary?: (record: StructuredResult) => string | undefined,
    ) => {
      if (busy) return
      setBusy(true)
      setStatus(`looking up ${label}…`)
      void run()
        .then((record) => {
          setBusy(false)
          setStatus('')
          presentRecord(sectionId, record, view)
          const line = summary?.(record)
          if (line) appendNote(sectionId, line)
        })
        .catch((error: unknown) => {
          setBusy(false)
          setStatus('')
          appendNote(
            sectionId,
            `Couldn't open ${label} — ${error instanceof Error ? error.message : String(error)}`,
            'error',
          )
        })
    },
    [appendNote, busy, presentRecord, setBusy, setStatus],
  )

  const openAsset = useCallback(
    (sectionId: number, assetId: number) => {
      lookupById(sectionId, `asset ${assetId}`, 'asset.detail', () => host().lookupAsset(assetId), (record) => {
        const derived = createAssetDetailViewModel(storeRef.current, viewFor(record, 'asset.detail'))
        return derived.ok
          ? `${derived.model.name ?? 'Asset'} · ${derived.model.decimals} decimals · supply ${derived.model.totalSupply}.`
          : undefined
      })
    },
    [host, lookupById, storeRef],
  )

  const openApplication = useCallback(
    (sectionId: number, applicationId: number) => {
      lookupById(
        sectionId,
        `application ${applicationId}`,
        'application.detail',
        () => host().lookupApplication(applicationId),
        (record) => {
          const derived = createApplicationDetailViewModel(
            storeRef.current,
            viewFor(record, 'application.detail'),
          )
          return derived.ok
            ? `App ${derived.model.applicationId} · ${derived.model.globalStateCount} global state key${derived.model.globalStateCount === 1 ? '' : 's'}.`
            : undefined
        },
      )
    },
    [host, lookupById, storeRef],
  )

  const openGroup = useCallback(
    (sectionId: number, groupId: string) => {
      lookupById(
        sectionId,
        `group ${groupId.slice(0, 8)}…`,
        'transaction.group',
        () => host().lookupTransactionGroup(groupId),
        (record) => {
          const derived = createTransactionCollectionViewModel(
            storeRef.current,
            viewFor(record, 'transaction.group'),
          )
          return derived.ok
            ? `${derived.model.transactions.length} transaction${derived.model.transactions.length === 1 ? '' : 's'} in the group.`
            : undefined
        },
      )
    },
    [host, lookupById, storeRef],
  )

  const openBlock = useCallback(
    (sectionId: number, round: number) => {
      lookupById(sectionId, `block ${round}`, 'block.detail', () => host().lookupBlock(round), (record) => {
        const derived = createBlockDetailViewModel(storeRef.current, viewFor(record, 'block.detail'))
        return derived.ok
          ? `Round ${derived.model.round} · ${derived.model.transactionCount} transaction${derived.model.transactionCount === 1 ? '' : 's'}.`
          : undefined
      })
    },
    [host, lookupById, storeRef],
  )

  const openAmbiguous = useCallback(
    (sectionId: number, raw: string) => {
      const id = Number(raw)
      if (busy || !Number.isSafeInteger(id)) return
      setBusy(true)
      setStatus(`looking up ${raw} as asset, application, and block…`)
      void lookupAmbiguousEntity(host(), id)
        .then((outcome) => {
          setBusy(false)
          setStatus('')
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
        })
        .catch((error: unknown) => {
          setBusy(false)
          setStatus('')
          appendNote(
            sectionId,
            `Couldn't look up ${raw} — ${error instanceof Error ? error.message : String(error)}`,
            'error',
          )
        })
    },
    [appendNote, busy, host, networkRef, presentRecord, setBusy, setStatus],
  )

  return {
    openTransaction,
    openAccount,
    openAccountName,
    openMyAccounts,
    openAsset,
    openApplication,
    openGroup,
    openBlock,
    openAmbiguous,
  }
}

export type LookupLane = ReturnType<typeof useLookups>
