'use client'

/**
 * The web Explorer's shell: top bar, session index, the route's screen, and
 * the composer, persisting across every URL. `/` is the transcript; the
 * other routes are screens over the same store. This component is the
 * composition root — the feed, the network, lookups, and the write flow
 * each live in their own hook; the genuinely shared state (result store,
 * busy flag, status line) stays here and reaches screens through
 * `useExplorer`.
 */
import {
  createFixtureResultStore,
  createWriteFlowViewModel,
  type ResultStore,
} from '@initlabs/vibekit-explorer'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { HELP, routeComposerInput } from './commands'
import { EnrichmentProvider } from './enrich'
import { RoundPulse } from './features/network/pulse'
import { Composer, NavPane } from './feed/feed'
import { useFeed, type Feed, type SectionBlock } from './feed/hooks'
import { defaultNetwork, NETWORKS, useNetwork, type ExplorerHost } from './features/network/hooks'
import { NfdCard } from './features/plugins/nfd-card'
import { WriteFlowCard } from './features/write-flow/cards'
import { useWriteFlow } from './features/write-flow/hooks'
import { ApprovalModal } from './features/write-flow/modal'
import { useLookups } from './lookup'
import type { LiveNetworkId, ResultStore as Store } from '@initlabs/vibekit-explorer'
import { Button, CopyContext } from './primitives'
import type { NfdProfile, RemoteExplorerHost } from './remote-host'
import { ResultCard, type OpenTarget } from './result-card'
import { shorten } from './theme'
import { useWalletLane, WalletRoot, type WalletLane } from './wallet/provider'

/** What a screen can reach: the store, the hosts, the wallet, the transcript, and the lanes. */
export interface ExplorerContextValue {
  store: Store
  storeRef: { current: Store }
  commitStore: (next: Store) => void
  host: () => ExplorerHost
  remoteHost: RemoteExplorerHost
  live: 'probing' | boolean
  network: LiveNetworkId
  latestRound: number | undefined
  wallet: WalletLane
  activeAddress: string | undefined
  feed: Feed
  busy: boolean
  openTarget: (target: OpenTarget) => void
  submit: (raw: string) => void
  setStatus: (text: string) => void
  renderBlock: (block: SectionBlock, sectionId: number, itemId: number) => ReactNode
}

const ExplorerContext = createContext<ExplorerContextValue | null>(null)

export function useExplorer(): ExplorerContextValue {
  const value = useContext(ExplorerContext)
  if (!value) throw new Error('useExplorer needs the Explorer shell above it')
  return value
}

const TABS = [
  { href: '/', label: 'explore' },
  { href: '/assets', label: 'assets' },
  { href: '/apps', label: 'apps' },
  { href: '/txns', label: 'txns' },
  { href: '/blocks', label: 'blocks' },
] as const

/** The layout mounts this inside the wallet provider, client-only. */
export function ExplorerShell({ children }: { children: ReactNode }) {
  return (
    <WalletRoot>
      <ExplorerApp>{children}</ExplorerApp>
    </WalletRoot>
  )
}

function ExplorerApp({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const goHome = useCallback(() => {
    if (pathname !== '/') router.push('/')
  }, [pathname, router])
  const [store, setStore] = useState<ResultStore>(createFixtureResultStore)
  const storeRef = useRef(store)
  storeRef.current = store
  const commitStore = useCallback((next: ResultStore) => {
    storeRef.current = next
    setStore(next)
  }, [])
  const [busy, setBusyState] = useState(false)
  const busyRef = useRef(false)
  const setBusy = useCallback((next: boolean) => {
    busyRef.current = next
    setBusyState(next)
  }, [])
  const [status, setStatus] = useState('')
  const newId = useCallback((prefix: string) => `${prefix}-${crypto.randomUUID()}`, [])

  const [network, setNetworkState] = useState(defaultNetwork)
  const wallet = useWalletLane(network)
  const { accounts, activeAddress, signDraft } = wallet
  const { setNetwork, networkRef, host, remoteHost, live, latestRound } = useNetwork({
    signDraft,
    network,
    tailing: pathname === '/blocks',
  })
  useEffect(() => setNetwork(network), [network, setNetwork])
  const feed = useFeed()
  const { sections, selectedId, selectSection, createSection, appendNote } = feed
  const shared = { feed, storeRef, commitStore, host, live, networkRef, busyRef, setBusy, setStatus }
  const lookups = useLookups({ ...shared, remoteHost, accounts })
  const payment = useWriteFlow({ ...shared, newId, accounts, activeAddress })

  const switchNetwork = useCallback(
    (target: (typeof NETWORKS)[number] | undefined, sectionId?: number) => {
      const report = (text: string, tone: 'muted' | 'error' = 'muted') =>
        sectionId === undefined ? setStatus(text) : appendNote(sectionId, text, tone)
      if (payment.flowRef.current !== null) {
        report('Finish or deny the write before switching networks.', 'error')
        return
      }
      const current = networkRef.current
      const next = target ?? NETWORKS[(NETWORKS.indexOf(current) + 1) % NETWORKS.length]!
      if (next === current) {
        report(`Already on ${next}.`)
        return
      }
      setNetworkState(next)
      report(`Switched to ${next}. Existing sections keep their original network.`)
    },
    [appendNote, networkRef, payment.flowRef, setNetwork],
  )

  const openTarget = useCallback(
    (target: OpenTarget) => {
      goHome()
      switch (target.kind) {
        case 'transaction':
          return void lookups.openTransaction(createSection(target.txid), target.txid)
        case 'account':
          return void lookups.openAccount(createSection(target.address), target.address)
        case 'asset':
          return void lookups.openAsset(createSection(`asset ${target.assetId}`), target.assetId)
        case 'application':
          return void lookups.openApplication(createSection(`app ${target.applicationId}`), target.applicationId)
        case 'block':
          return void lookups.openBlock(createSection(`block ${target.round}`), target.round)
        case 'holdings':
          return void lookups.openHoldings(createSection(`assets of ${target.address.slice(0, 8)}…`), target.address)
        case 'transactions':
          return void lookups.openTransactions(createSection('transactions'), target.filter)
      }
    },
    [createSection, goHome, lookups],
  )

  const submit = useCallback(
    (raw: string) => {
      const outcome = routeComposerInput(raw)
      // A screen's name is a route; everything else lands in the transcript.
      if (outcome.status === 'nav') return router.push(`/${outcome.screen}`)
      goHome()
      const sectionId = createSection(raw.trim())
      switch (outcome.status) {
        case 'payment':
          return payment.startPayment(sectionId, outcome.amountMicroAlgos, outcome.to)
        case 'transaction':
          return void lookups.openTransaction(sectionId, outcome.txid)
        case 'group':
          return void lookups.openGroup(sectionId, outcome.groupId)
        case 'account':
          return void lookups.openAccount(sectionId, outcome.address)
        case 'account-name':
          return lookups.openAccountName(sectionId, outcome.name)
        case 'account-list':
          return void lookups.openMyAccounts(sectionId)
        case 'asset':
          return void lookups.openAsset(sectionId, outcome.assetId)
        case 'application':
          return void lookups.openApplication(sectionId, outcome.applicationId)
        case 'block':
          return void lookups.openBlock(sectionId, outcome.round)
        case 'network':
          if (outcome.network) return switchNetwork(outcome.network, sectionId)
          return appendNote(sectionId, `You're on ${networkRef.current}. Use "network localnet|testnet|mainnet" or click the chip to switch.`)
        case 'help':
          return appendNote(sectionId, HELP)
        case 'ambiguous':
          return void lookups.openAmbiguous(sectionId, outcome.value)
        case 'text':
          return appendNote(sectionId, 'No agent configured. Paste an id, or `pay 0.5 to <address>`.', 'error')
      }
    },
    [appendNote, createSection, goHome, lookups, networkRef, payment, router, switchNetwork],
  )

  const renderBlock = useCallback(
    (block: SectionBlock, sectionId: number, itemId: number) => {
      switch (block.kind) {
        case 'view':
          return (
            <ResultCard
              store={store}
              view={block.view}
              onOpen={openTarget}
              onMore={() => lookups.loadMore(sectionId, itemId, block.view)}
              loadingMore={lookups.loadingMore === itemId}
            />
          )
        case 'write': {
          const derived = createWriteFlowViewModel(store, block.flow)
          const isOpen = payment.flowRef.current?.flowId === block.flow.flowId
          return (
            <WriteFlowCard
              model={derived.ok ? derived.model : undefined}
              errorMessage={derived.ok ? undefined : derived.error.message}
              network={block.flow.draft ? (derived.ok ? derived.model.network : network) : network}
              busy={busy && isOpen}
              onClose={isOpen ? payment.closeFlow : undefined}
            />
          )
        }
        case 'raw':
          return <pre className="note">{block.text}</pre>
        case 'plugin': {
          if (block.view !== 'nfd.profile') return <pre className="raw">{JSON.stringify(block.data, null, 2)}</pre>
          const data = block.data as NfdProfile
          return (
            <NfdCard
              data={data}
              network={block.network}
              onOpenAccount={data.address ? () => openTarget({ kind: 'account', address: data.address! }) : undefined}
            />
          )
        }
      }
    },
    [busy, lookups, network, openTarget, payment, store],
  )

  // The one moment the UI waits on a human: a true modal over everything.
  const approval =
    payment.flow?.stage === 'awaiting-approval' ? createWriteFlowViewModel(store, payment.flow) : undefined
  const announceCopy = useCallback((text: string) => setStatus(`copied ${shorten(text, 28)}`), [])
  // `/` jumps to the composer from anywhere; Esc returns to the feed.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'
      if (event.key === '/' && !typing) {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('.composer input')?.focus()
      } else if (event.key === 'Escape' && !approval) {
        goHome()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [approval, goHome])
  const modeLabel = live === 'probing' ? 'probing…' : live ? 'live' : 'sample data'
  const statusLine =
    status ||
    wallet.networkError ||
    (live === false ? `sample data — ${network} is unreachable; fixture tx and accounts only` : '')

  const context = useMemo<ExplorerContextValue>(
    () => ({
      store,
      storeRef,
      commitStore,
      host,
      remoteHost,
      live,
      network,
      latestRound,
      wallet,
      activeAddress,
      feed,
      busy,
      openTarget,
      submit,
      setStatus,
      renderBlock,
    }),
    [activeAddress, busy, commitStore, feed, host, latestRound, live, network, openTarget, remoteHost, renderBlock, store, submit, wallet],
  )

  return (
    <EnrichmentProvider host={remoteHost} live={live === true}>
    <CopyContext.Provider value={announceCopy}>
    <ExplorerContext.Provider value={context}>
    <main className="shell">
      <header className="top">
        <div className="top-row">
          <span className="brand">
            VIBEKIT <b>EXPLORER</b>
          </span>
          <span className="top-state">
            <span>
              <span className={`live-dot${live === true ? ' on' : ''}`}>{live === true ? '●' : '○'}</span>{' '}
              {modeLabel}
              {latestRound === undefined ? null : (
                <>
                  {' '}
                  <RoundPulse round={latestRound} />
                  <span className="round" key={latestRound}>{latestRound}</span>
                </>
              )}
            </span>
            <button className={`net net-${network}`} onClick={() => switchNetwork(undefined)} title="switch network">
              {network}
            </button>
            <Link href="/wallet" className={`button${pathname === '/wallet' ? ' button-active' : ''}`}>
              {activeAddress ? `▸ ${wallet.activeName ?? shorten(activeAddress, 12)}` : '▸ no wallet'}
            </Link>
          </span>
        </div>
        <nav className="top-row tabs">
          {TABS.map((tab) => (
            <Link key={tab.href} href={tab.href} className={`button${pathname === tab.href ? ' button-active' : ''}`}>
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="body">
        <NavPane
          sections={sections}
          selectedId={selectedId}
          onSelect={(id) => {
            goHome()
            selectSection(id)
          }}
        />
        {children}
      </div>
      <Composer onSubmit={submit} status={statusLine} placeholder="paste an id, `asset 31566704`, or `pay 0.5 to <address>`" />
      {approval ? (
        <ApprovalModal
          model={approval.ok ? approval.model : undefined}
          network={network}
          busy={busy}
          onApprove={() => payment.decide('approve')}
          onDeny={() => payment.decide('deny')}
        />
      ) : null}
    </main>
    </ExplorerContext.Provider>
    </CopyContext.Provider>
    </EnrichmentProvider>
  )
}
