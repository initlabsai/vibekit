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

import { EnrichmentProvider } from './enrich'
import { RoundPulse } from './features/network/pulse'
import { Composer, NavPane } from './feed/feed'
import { useFeed, type Feed, type SectionBlock } from './feed/hooks'
import { useAgentLane } from './features/agent/hooks'
import { useComposer } from './features/composer/hooks'
import { usePanel } from './features/layout/hooks'
import { defaultNetwork, useNetwork, type ExplorerHost } from './features/network/hooks'
import { NfdCard } from './features/plugins/nfd-card'
import { ProfileRail } from './features/profile/rail'
import { WriteFlowCard } from './features/write-flow/cards'
import { useWriteFlow } from './features/write-flow/hooks'
import { ApprovalModal } from './features/write-flow/modal'
import { useLookups } from './lookup'
import type { LiveNetworkId, ResultStore as Store } from '@initlabs/vibekit-explorer'
import { Button, CopyContext, OpenContext } from './primitives'
import type { NfdProfile, RemoteExplorerHost } from './remote-host'
import { ResultCard, type OpenTarget } from './result-card'
import { shorten } from './theme'
import { WalletMenu } from './features/wallet/menu'
import { useWalletLane, WalletRoot, type WalletLane } from './wallet/provider'

/** A tool result with no card of its own: folded to its name; the JSON is one click away. */
function RawBlock({ title, text }: { title: string; text: string }) {
  return (
    <details className="raw-block">
      <summary>
        <span className="kicker">{title}</span>
        <span className="muted"> · raw result</span>
      </summary>
      <pre className="raw">{text}</pre>
    </details>
  )
}

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
  /** The agent lane's status and its latest line, for the composer and the companion. */
  agent: { enabled: boolean; model?: string; provider?: string; streamingSection: number | null }
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
  const { sections, selectedId, selectSection } = feed
  const shared = { feed, storeRef, commitStore, host, live, networkRef, busyRef, setBusy, setStatus }
  const lookups = useLookups({ ...shared, remoteHost, accounts })
  const payment = useWriteFlow({ ...shared, newId, accounts, activeAddress })
  const agent = useAgentLane({
    feed,
    storeRef,
    commitStore,
    networkRef,
    accounts,
    activeAddress,
    live,
    busyRef,
    setBusy,
    setStatus,
    startFromDraft: payment.startFromDraft,
  })

  const { submit, openTarget, switchNetwork, goHome } = useComposer({
    pathname,
    push: router.push,
    feed,
    lookups,
    payment,
    networkRef,
    setNetwork: setNetworkState,
    setStatus,
    runAgent: agent.runAgent,
  })

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
          return <RawBlock title={block.title} text={block.text} />
        case 'plugin': {
          if (block.view !== 'nfd.profile') return <RawBlock title={block.view} text={JSON.stringify(block.data, null, 2)} />
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
    (live === false ? `sample data — ${network} is unreachable; fixture tx and accounts only` : '') ||
    (agent.status.enabled ? `${agent.status.model} · early alpha` : 'no agent configured · the direct lane still works')

  const sheetRef = useRef<HTMLDetailsElement>(null)
  const closeSheet = useCallback(() => sheetRef.current?.removeAttribute('open'), [])

  // Both side panels fold; the viewer's choice is remembered per browser.
  const [railOpen, toggleRail] = usePanel('vibekit.rail')
  const [navOpen, toggleNav] = usePanel('vibekit.nav')

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
      agent: { enabled: agent.status.enabled, model: agent.status.model, provider: agent.status.provider, streamingSection: agent.streamingSection },
    }),
    [activeAddress, agent.streamingSection, agent.status.enabled, agent.status.model, agent.status.provider, busy, commitStore, feed, host, latestRound, live, network, openTarget, remoteHost, renderBlock, store, submit, wallet],
  )

  return (
    <EnrichmentProvider host={remoteHost} live={live === true}>
    <CopyContext.Provider value={announceCopy}>
    <OpenContext.Provider value={openTarget}>
    <ExplorerContext.Provider value={context}>
    <main className={`shell${railOpen ? ' rail-open' : ' rail-folded'}${navOpen ? '' : ' nav-folded'}`}>
      <header className="top">
        <div className="top-row">
          <span className="brand">
            VIBEKIT <b>AGENT</b>
          </span>
          <span className="top-state">
            <span>
              <span className={`live-dot${live === true ? ' on' : ''}`}>{live === true ? '●' : '○'}</span>{' '}
              <span className="live-label">{modeLabel}</span>
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
            <WalletMenu lane={wallet} onError={setStatus} />
          </span>
          {/* Phones: everything above folds into one sheet behind ☰. */}
          <details className="sheet" ref={sheetRef}>
            <summary className="button" aria-label="menu">☰</summary>
            <div className="sheet-body">
              <nav className="tabs">
                {TABS.map((tab) => (
                  <Link key={tab.href} href={tab.href} className={`button${pathname === tab.href ? ' button-active' : ''}`} onClick={closeSheet}>
                    {tab.label}
                  </Link>
                ))}
              </nav>
              <div className="sheet-row">
                <span>
                  <span className={`live-dot${live === true ? ' on' : ''}`}>{live === true ? '●' : '○'}</span> {modeLabel}
                  {latestRound === undefined ? null : <span className="round"> {latestRound}</span>}
                </span>
                <button className={`net net-${network}`} onClick={() => switchNetwork(undefined)} title="switch network">
                  {network}
                </button>
              </div>
              <div className="sheet-row">
                <WalletMenu lane={wallet} onError={setStatus} />
                <Button label="account ▸" onPress={() => { toggleRail(); closeSheet() }} />
              </div>
              <NavPane
                sections={sections}
                selectedId={selectedId}
                onSelect={(id) => {
                  goHome()
                  selectSection(id)
                  closeSheet()
                }}
                open
                onToggle={closeSheet}
              />
            </div>
          </details>
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
          open={navOpen}
          onToggle={toggleNav}
        />
        {children}
        <ProfileRail open={railOpen} onToggle={toggleRail} />
      </div>
      <Composer
        onSubmit={submit}
        status={statusLine}
        placeholder={agent.status.enabled ? `ask anything, paste an id, or / for commands · ${agent.status.model} via ${agent.status.provider}, not private` : 'paste an id, or / for commands'}
      />
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
    </OpenContext.Provider>
    </CopyContext.Provider>
    </EnrichmentProvider>
  )
}
