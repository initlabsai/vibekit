import {
  addResult,
  FIXTURE_ADDRESS_BOOK,
  FIXTURE_SENDER,
  type ResultStore,
  type ViewSpec,
} from '@initlabs/vibekit-explorer'
import { useCallback, useEffect, useState } from 'react'

import type { WorkspaceScreen } from '../chrome.js'
import type { KeystorePaymentHost } from '../keystore-host.js'
import { errorMessage } from '../theme.js'
import type { Focus } from './feed.js'
import { loadNextPage, viewFor } from './lookup.js'
import type { ExplorerHost } from './network.js'

/**
 * Owns the workspace screens and who is acting: keystore signing accounts,
 * the active sender, the wallet screen, and the per-account shelf views.
 */
export function useAccounts({
  keystoreHost,
  host,
  network,
  commitStore,
  storeRef,
  setFocus,
}: {
  keystoreHost: KeystorePaymentHost
  host: () => ExplorerHost
  network: string
  commitStore: (next: ResultStore) => void
  storeRef: { current: ResultStore }
  setFocus: (focus: Focus) => void
}) {
  /** down: no daemon on the socket; empty: daemon up, no keys; ready: keys to sign with. */
  const [signer, setSigner] = useState<'down' | 'empty' | 'ready'>('down')
  const signerReady = signer === 'ready'
  const [activeSender, setActiveSender] = useState<string | undefined>(FIXTURE_SENDER)
  const [screen, setScreen] = useState<WorkspaceScreen>('chat')
  const [shelfView, setShelfView] = useState<ViewSpec | undefined>()
  const [shelfError, setShelfError] = useState<string | undefined>()
  const [shelfLoading, setShelfLoading] = useState(false)
  const [shelfLoadingMore, setShelfLoadingMore] = useState(false)

  const loadMoreShelf = useCallback(() => {
    if (!shelfView || shelfLoadingMore) return
    setShelfLoadingMore(true)
    void loadNextPage({ host: host(), storeRef, commitStore, network, view: shelfView })
      .then((next) => {
        if (next) setShelfView(next)
      })
      .catch((error: unknown) => setShelfError(errorMessage(error)))
      .finally(() => setShelfLoadingMore(false))
  }, [commitStore, host, network, shelfLoadingMore, shelfView, storeRef])
  const [accountList, setAccountList] = useState<ReadonlyArray<{ address: string; name?: string }>>(
    [],
  )
  const [accountsLoading, setAccountsLoading] = useState(false)
  /** address → microALGO on the current network; absent while loading or unknown. */
  const [balances, setBalances] = useState<Record<string, number | string>>({})

  // Wallet page balances: one batch lookup per (network, address book).
  useEffect(() => {
    if (screen !== 'wallet' || accountList.length === 0) return
    let cancelled = false
    setBalances({})
    void host()
      .lookupAccounts(accountList.map((account) => account.address))
      .then((record) => {
        if (cancelled || record.state !== 'success') return
        const data = record.data as {
          accounts?: Array<{ address: string; balanceMicroAlgos: number | string }>
        }
        setBalances(
          Object.fromEntries((data.accounts ?? []).map((a) => [a.address, a.balanceMicroAlgos])),
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [accountList, host, network, screen])

  useEffect(() => {
    let cancelled = false
    keystoreHost
      .listSigningAccounts()
      .then((accounts) => {
        if (cancelled) return
        setSigner(accounts.length > 0 ? 'ready' : 'empty')
        setAccountList(accounts)
        setActiveSender((current) =>
          current && accounts.some((account) => account.address === current)
            ? current
            : (accounts[0]?.address ?? FIXTURE_SENDER),
        )
      })
      .catch(() => {
        if (cancelled) return
        setSigner('down')
        setAccountList([...FIXTURE_ADDRESS_BOOK])
        setActiveSender(FIXTURE_SENDER)
      })
    return () => {
      cancelled = true
    }
  }, [keystoreHost])

  const openWallet = useCallback(() => {
    setScreen('wallet')
    setFocus('composer')
    setAccountsLoading(true)
    const source = signerReady
      ? keystoreHost.listSigningAccounts()
      : Promise.resolve([...FIXTURE_ADDRESS_BOOK])
    void source
      .then((accounts) => {
        setAccountList(accounts)
        setAccountsLoading(false)
      })
      .catch(() => {
        setAccountList([...FIXTURE_ADDRESS_BOOK])
        setAccountsLoading(false)
      })
  }, [keystoreHost, setFocus, signerReady])

  const loadShelf = useCallback(
    (target: 'assets' | 'txns', address: string | undefined) => {
      if (!address) {
        setShelfView(undefined)
        setShelfError(undefined)
        setShelfLoading(false)
        return
      }
      setShelfLoading(true)
      setShelfError(undefined)
      setShelfView(undefined)
      const run =
        target === 'assets'
          ? () => host().lookupAccountAssets(address)
          : () => host().searchTransactions({ address })
      const viewId =
        target === 'assets' ? ('asset.holdings' as const) : ('transaction.list' as const)
      void run()
        .then((record) => {
          const nextStore = addResult(storeRef.current, record)
          commitStore(nextStore)
          setShelfView(viewFor(record, viewId))
          setShelfLoading(false)
        })
        .catch((error: unknown) => {
          setShelfLoading(false)
          setShelfError(errorMessage(error))
        })
    },
    [commitStore, host, storeRef],
  )

  const openWorkspace = useCallback(
    (target: Exclude<WorkspaceScreen, 'chat'>) => {
      setScreen(target)
      setFocus('composer')
      if (target === 'wallet') openWallet()
    },
    [openWallet, setFocus],
  )

  const cycleAccount = useCallback(
    (delta: number) => {
      if (accountList.length === 0) return
      const current = accountList.findIndex((account) => account.address === activeSender)
      const index = (current + delta + accountList.length) % accountList.length
      setActiveSender(accountList[index]!.address)
    },
    [accountList, activeSender],
  )

  // 'apps' is not shelf-shaped — its screen owns its own data (slices/apps.ts).
  useEffect(() => {
    if (screen === 'assets' || screen === 'txns') {
      loadShelf(screen, activeSender)
    }
  }, [activeSender, loadShelf, screen])

  return {
    signer,
    signerReady,
    activeSender,
    setActiveSender,
    screen,
    setScreen,
    shelfView,
    shelfLoadingMore,
    loadMoreShelf,
    shelfError,
    shelfLoading,
    accountList,
    accountsLoading,
    balances,
    openWorkspace,
    cycleAccount,
  }
}
