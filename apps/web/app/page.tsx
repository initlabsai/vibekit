'use client'

/**
 * The web Explorer as a chat-first transcript: a session index on the left,
 * a feed on the right where each request's cards and notes accrete, and the
 * composer below. This component is the composition root — the feed, the
 * network, lookups, and the write flow each live in their own hook; the
 * genuinely shared state (result store, busy flag, status line) stays here.
 */
import {
  createFixtureResultStore,
  createWriteFlowViewModel,
  FIXTURE_ADDRESS_BOOK,
  FIXTURE_TRANSACTION_ID,
  type ResultStore,
} from '@initlabs/vibekit-explorer'
import { useCallback, useRef, useState } from 'react'

import { HELP, routeComposerInput, type WalletAccount } from '../src/commands'
import { Composer, FeedPane, NavPane } from '../src/feed/feed'
import { useFeed, type SectionBlock } from '../src/feed/hooks'
import { NETWORKS, useNetwork } from '../src/features/network/hooks'
import { useWriteFlow } from '../src/features/write-flow/hooks'
import { useLookups } from '../src/lookup'
import { Button } from '../src/primitives'
import { ResultCard, type OpenTarget } from '../src/result-card'
import { AccountsLanding, Welcome } from '../src/views'
import { WriteFlowView } from '../src/write-flow'

type Screen = 'chat' | 'wallet'

export default function Page() {
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
  const [screen, setScreen] = useState<Screen>('chat')
  const newId = useCallback((prefix: string) => `${prefix}-${crypto.randomUUID()}`, [])

  // No wallet is connected yet: the address book is the sample one.
  const accounts: ReadonlyArray<WalletAccount> = []
  const activeAddress: string | undefined = undefined

  const { network, setNetwork, networkRef, host, live, latestRound } = useNetwork()
  const feed = useFeed()
  const { sections, selectedId, selectSection, createSection, appendNote } = feed
  const shared = { feed, storeRef, commitStore, host, live, networkRef, busyRef, setBusy, setStatus }
  const lookups = useLookups({ ...shared, accounts })
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
      setNetwork(next)
      report(`Switched to ${next}. Existing sections keep their original network.`)
    },
    [appendNote, networkRef, payment.flowRef, setNetwork],
  )

  const openTarget = useCallback(
    (target: OpenTarget) => {
      setScreen('chat')
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
    [createSection, lookups],
  )

  const submit = useCallback(
    (raw: string) => {
      const outcome = routeComposerInput(raw)
      setScreen('chat')
      if (outcome.status === 'nav') {
        if (outcome.screen === 'wallet') return setScreen('wallet')
        const sectionId = createSection(raw.trim())
        if (outcome.screen === 'blocks') return void lookups.openLatestBlock(sectionId)
        if (!activeAddress) return appendNote(sectionId, 'Connect a wallet to see its assets, apps, and transactions.')
        if (outcome.screen === 'assets') return void lookups.openHoldings(sectionId, activeAddress)
        if (outcome.screen === 'txns') return void lookups.openTransactions(sectionId, { address: activeAddress })
        return appendNote(sectionId, 'App lookups take an id: `app 1002541853`.')
      }
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
    [activeAddress, appendNote, createSection, lookups, networkRef, payment, switchNetwork],
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
            <WriteFlowView
              model={derived.ok ? derived.model : undefined}
              errorMessage={derived.ok ? undefined : derived.error.message}
              canSign={live !== true}
              terminalNote={undefined}
              busy={busy && isOpen}
              onApprove={() => payment.decide('approve')}
              onDeny={() => payment.decide('deny')}
              onClose={payment.closeFlow}
            />
          )
        }
        case 'raw':
          return <pre className="note">{block.text}</pre>
        case 'plugin':
          return <pre className="note">{JSON.stringify(block.data, null, 2)}</pre>
      }
    },
    [busy, live, lookups, openTarget, payment, store],
  )

  const modeLabel = live === 'probing' ? 'probing…' : live ? 'live' : 'sample data'
  const statusLine =
    status || (live === false ? `sample data — ${network} is unreachable; fixture tx and accounts only` : '')

  return (
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
                  <span className="round" key={latestRound}>{latestRound}</span>
                </>
              )}
            </span>
            <button className={`net net-${network}`} onClick={() => switchNetwork(undefined)} title="switch network">
              {network}
            </button>
            <Button label="no wallet" active={screen === 'wallet'} onPress={() => setScreen('wallet')} />
          </span>
        </div>
        <nav className="top-row tabs">
          <Button label="explore" active={screen === 'chat'} onPress={() => setScreen('chat')} />
          {(['assets', 'apps', 'txns', 'blocks'] as const).map((tab) => (
            <Button key={tab} label={tab} onPress={() => submit(tab)} />
          ))}
        </nav>
      </header>
      <div className="body">
        <NavPane sections={sections} selectedId={selectedId} onSelect={selectSection} />
        {screen === 'wallet' ? (
          <section className="feed">
            <AccountsLanding
              accounts={FIXTURE_ADDRESS_BOOK}
              note="No wallet is connected. These are the sample accounts; paste any address into the composer."
              onOpen={(address) => openTarget({ kind: 'account', address })}
            />
          </section>
        ) : (
          <FeedPane
            sections={sections}
            selectedId={selectedId}
            renderBlock={renderBlock}
            empty={<Welcome onOpenSample={() => submit(FIXTURE_TRANSACTION_ID)} />}
          />
        )}
      </div>
      <Composer onSubmit={submit} status={statusLine} placeholder="paste an id, `asset 31566704`, or `pay 0.5 to <address>`" />
    </main>
  )
}
