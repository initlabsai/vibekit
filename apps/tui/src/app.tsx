import {
  createFixtureResultStore,
  createTransactionCollectionViewModel,
  findResultRecord,
  nextPageArgs,
  type ResultStore,
  type ViewSpec,
} from '@initlabs/vibekit-explorer'
import type { LiveNetworkId } from '@initlabs/vibekit-explorer/live'
import type { InputRenderable } from '@opentui/core'
import { useTerminalDimensions } from '@opentui/react'
import { useCallback, useMemo, useRef, useState } from 'react'

import { ApprovalModal, ConfirmModal } from './approval-modal.js'
import { AppsScreen, BlocksScreen, Composer, ShelfScreen, TopBar, WalletScreen } from './chrome.js'
import { routeComposerInput } from './commands.js'
import { CopyContext, useCopyOnSelect } from './copy-selection.js'
import { explainApplicationTool } from './explain-tool.js'
import { ContentPane, NavPane } from './sections.js'
import { transactionsFilterFor, type OpenTarget } from './views.js'
import { useAccounts } from './slices/accounts.js'
import { useApps } from './slices/apps.js'
import { useAgentLane } from './slices/agent.js'
import { useFeed } from './slices/feed.js'
import { useExplorerKeys } from './slices/keys.js'
import { useLookups } from './slices/lookup.js'
import { loadNextPage } from './slices/lookup.js'
import { NETWORKS, useNetwork } from './slices/network.js'
import { usePaymentFlow } from './slices/payment.js'
import { useBlockTail } from './slices/tail.js'
import { COLORS, errorMessage, shorten } from './theme.js'

const HELP = 'pay 0.5 to <label|address> · blocks · list my accounts · alice.algo · paste an id'

/**
 * The Explorer as a chat-first transcript plus results feed: a session index
 * on the left (one line per request) and a sticky-bottom feed on the right
 * where each request's narration, cards, and errors accrete as a group.
 * Tab hands focus to the feed; a payment decision is a true modal over
 * everything.
 *
 * This component is the composition root: each feature lives in a slice hook
 * under `slices/`, and the genuinely shared state (result store, busy flags,
 * status line) stays here and is passed into the hooks as parameters.
 */
export function App() {
  const dimensions = useTerminalDimensions()

  // Shared state: the trusted result store plus the cross-lane busy flags.
  const [store, setStore] = useState<ResultStore>(createFixtureResultStore)
  const [busy, setBusyState] = useState(false)
  // Guards read the ref: a callback created before setBusy(true) must still see it.
  const busyRef = useRef(false)
  const setBusy = useCallback((next: boolean) => {
    busyRef.current = next
    setBusyState(next)
  }, [])
  const [agentBusy, setAgentBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [inputEpoch, setInputEpoch] = useState(0)
  const [confirm, setConfirm] = useState<{ title: string; lines: string[]; resolve: (ok: boolean) => void } | null>(null)
  const askConfirm = useCallback(
    (title: string, lines: string[]) =>
      new Promise<boolean>((resolve) => setConfirm({ title, lines, resolve })),
    [],
  )
  // The renderer blurs the focused input on any click; these let the app
  // hand focus back to whichever input it still considers focused.
  const composerRef = useRef<InputRenderable | null>(null)
  const methodInputRef = useRef<InputRenderable | null>(null)

  const storeRef = useRef<ResultStore>(store)
  storeRef.current = store
  const commitStore = useCallback((next: ResultStore) => {
    storeRef.current = next
    setStore(next)
  }, [])
  const newId = useCallback((prefix: string) => `${prefix}-${crypto.randomUUID()}`, [])
  const copyIdent = useCopyOnSelect((text) =>
    setStatus(`copied ${shorten(text.replace(/\s+/g, ' '), 28)}`),
  )

  const net = useNetwork()
  const { network, networkRef, keystoreHost, host, live, setNetwork } = net

  const feed = useFeed()
  const { focus, setFocus, sections, selectedId, appendNote, createSection } = feed

  const accounts = useAccounts({ keystoreHost, host, network, commitStore, storeRef, setFocus })
  const {
    signerReady,
    activeSender,
    setActiveSender,
    screen,
    setScreen,
    accountList,
    cycleAccount,
    openWorkspace,
  } = accounts

  const apps = useApps({ screen, network, sender: activeSender, live, host })
  const agentExtraTools = useMemo(() => [...apps.extraTools, explainApplicationTool], [apps.extraTools])

  const lookup = useLookups({
    feed,
    host,
    keystoreHost,
    signerReady,
    commitStore,
    storeRef,
    networkRef,
    busyRef,
    setBusy,
    setStatus,
    specCatalog: apps.catalog,
  })
  const {
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
  } = lookup
  const activateAppsEntry = useCallback(
    (index: number) => {
      const entry = apps.entries[index - 1]
      if (!entry) return
      if (entry.kind === 'local') {
        const match = apps.deployed.find((deployed) => deployed.name === entry.spec.spec.name)
        apps.selectSpec({ spec: entry.spec, appId: match?.appId })
        return
      }
      const local =
        entry.kind === 'deployed' ? apps.localSpecs.find((spec) => spec.spec.name === entry.name) : undefined
      if (local) {
        apps.selectSpec({ spec: local, appId: entry.appId })
        return
      }
      // Opted-in, or deployed without a local spec: the same lane as `app <id>`.
      setScreen('chat')
      openApplication(createSection(`app ${entry.appId}`), entry.appId)
    },
    [apps, createSection, openApplication, setScreen],
  )
  const selectAppsMethod = useCallback(
    (index: number) => {
      const method = apps.selected?.spec.spec.methods[index - 1]
      if (method) apps.selectMethod(method)
    },
    [apps],
  )
  const closeAppsDetail = useCallback(() => apps.closeDetail(), [apps])

  const payment = usePaymentFlow({
    feed,
    store,
    storeRef,
    commitStore,
    host,
    newId,
    live,
    networkRef,
    accountList,
    activeSender,
    busy,
    busyRef,
    setBusy,
    setStatus,
  })
  const { flow, flowRef, startPayment, decide: decidePayment, isFlowSection, modalOpen: paymentModalOpen, modalModel } = payment
  // One modal at a time: the payment approval or an expensive-call confirm.
  // An agent-composed payment waits for the turn to end, so its one-line
  // narration lands before the modal takes the keyboard, not after the verdict.
  const approvalOpen = paymentModalOpen && !agentBusy
  const modalOpen = approvalOpen || confirm !== null
  const decide = useCallback(
    (decision: 'approve' | 'deny') => {
      if (confirm) {
        confirm.resolve(decision === 'approve')
        setConfirm(null)
        return
      }
      decidePayment(decision)
    },
    [confirm, decidePayment],
  )

  const tail = useBlockTail({
    live,
    host,
    network,
    screen,
    commitStore,
    storeRef,
  })

  // switchNetwork needs the agent lane's reset; the lane reaches it through this ref.
  const switchNetworkRef = useRef<(target: LiveNetworkId, sectionId: number) => void>(() => {})
  const agent = useAgentLane({
    feed,
    payment,
    keystoreHost,
    networkRef,
    activeSender,
    signerReady,
    commitStore,
    storeRef,
    newId,
    agentBusy,
    setAgentBusy,
    setStatus,
    extraTools: agentExtraTools,
    specCatalog: apps.catalog,
    specHashCatalog: apps.hashCatalog,
    onNetworkUsed: (target, sectionId) => switchNetworkRef.current(target, sectionId),
    askConfirm,
  })
  const { agentConfig, runAgent, agentSectionRef, reset: resetAgent } = agent

  const switchNetwork = useCallback(
    (target?: LiveNetworkId, sectionId?: number) => {
      const report = (text: string, tone: 'muted' | 'error' = 'muted') => {
        if (sectionId !== undefined) appendNote(sectionId, text, tone)
        else setStatus(text)
      }
      if (flowRef.current !== null) {
        report('Finish or deny the payment before switching networks.', 'error')
        return
      }
      const current = networkRef.current
      const next = target ?? NETWORKS[(NETWORKS.indexOf(current) + 1) % NETWORKS.length]!
      if (next === current) {
        report(`Already on ${next}.`)
        return
      }
      resetAgent()
      setNetwork(next)
      report(`Switched to ${next}. Existing sections keep their original network.`)
    },
    [appendNote, flowRef, networkRef, resetAgent, setNetwork],
  )
  switchNetworkRef.current = switchNetwork

  // Drill-in from any card: its own section, same lanes as typed input.
  const openTarget = useCallback(
    (target: OpenTarget) => {
      setScreen('chat')
      switch (target.kind) {
        case 'transaction':
          openTransaction(createSection(target.txid), target.txid)
          return
        case 'account':
          openAccount(createSection(target.address), target.address)
          return
        case 'asset':
          openAsset(createSection(`asset ${target.assetId}`), target.assetId)
          return
        case 'application':
          openApplication(createSection(`app ${target.applicationId}`), target.applicationId)
          return
        case 'program': {
          const prompt = `explain app ${target.applicationId}`
          runAgent(createSection(prompt), prompt)
          return
        }
        case 'block':
          openBlock(createSection(`block ${target.round}`), target.round)
          return
        case 'holdings':
          openHoldings(createSection(`assets of ${shorten(target.address, 12)}`), target.address)
          return
        case 'transactions': {
          const f = target.filter
          const prompt = f.address
            ? `txns of ${shorten(f.address, 12)}`
            : f.assetId !== undefined
              ? `txns of asset ${f.assetId}`
              : f.applicationId !== undefined
                ? `txns of app ${f.applicationId}`
                : `txns in round ${f.round}`
          openTransactions(createSection(prompt), f)
        }
      }
    },
    [createSection, openAccount, openApplication, openAsset, openBlock, openHoldings, openTransaction, openTransactions, runAgent, setScreen],
  )

  // Keyboard path for table rows: the highlighted list, else the newest one in the selected section.
  const openListRow = useCallback(
    (index: number) => {
      const section = sections.find((candidate) => candidate.id === selectedId)
      if (!section) return
      for (let i = section.items.length - 1; i >= 0; i -= 1) {
        const item = section.items[i]!
        if (item.kind !== 'block' || item.block.kind !== 'view') continue
        if (feed.cursorItemId !== null && item.id !== feed.cursorItemId) continue
        const { view } = item.block
        if (view.view !== 'transaction.list' && view.view !== 'transaction.group') continue
        const derived = createTransactionCollectionViewModel(storeRef.current, view)
        const txid = derived.ok ? derived.model.transactions[index - 1]?.id : undefined
        if (txid) openTarget({ kind: 'transaction', txid })
        return
      }
    },
    [feed.cursorItemId, openTarget, sections, selectedId, storeRef],
  )

  const [loadingMoreItemId, setLoadingMoreItemId] = useState<number | null>(null)
  const [navOpen, setNavOpen] = useState(true)
  const toggleNav = useCallback(() => setNavOpen((open) => !open), [])
  const loadMore = useCallback(
    (sectionId: number, itemId: number, view: ViewSpec) => {
      if (loadingMoreItemId !== null) return
      setLoadingMoreItemId(itemId)
      void loadNextPage({ host: host(), storeRef, commitStore, network: networkRef.current, view })
        .then((next) => {
          if (next) feed.replaceBlockView(sectionId, itemId, next)
        })
        .catch((error: unknown) => appendNote(sectionId, `Couldn't load more — ${errorMessage(error)}`, 'error'))
        .finally(() => setLoadingMoreItemId(null))
    },
    [appendNote, commitStore, feed.replaceBlockView, host, loadingMoreItemId, networkRef, storeRef],
  )

  // Card actions by key, on the rule 1-9 already uses: the newest card in the
  // selected section that offers the action. Presence doubles as the keybar's hint.
  // Card actions by key act on the highlighted card; with no cursor yet, on
  // the newest card in the selected section. Presence doubles as the keybar's hint.
  const cardActions = useMemo(() => {
    const section = sections.find((candidate) => candidate.id === selectedId)
    const views = (section?.items ?? [])
      .flatMap((item) => (item.kind === 'block' && item.block.kind === 'view' ? [{ itemId: item.id, view: item.block.view }] : []))
      .filter((card) => feed.cursorItemId === null || card.itemId === feed.cursorItemId)
      .reverse()
    const actions: { rows?: true; t?: () => void; e?: () => void; m?: () => void; a?: () => void } = {}
    for (const { itemId, view } of views) {
      if (!actions.rows && (view.view === 'transaction.list' || view.view === 'transaction.group')) actions.rows = true
      if (!actions.t) {
        const filter = transactionsFilterFor(storeRef.current, view)
        if (filter) actions.t = () => openTarget({ kind: 'transactions', filter })
      }
      if (!actions.e && view.view === 'application.detail') {
        const filter = transactionsFilterFor(storeRef.current, view)
        if (filter?.applicationId !== undefined) {
          const { applicationId } = filter
          actions.e = () => openTarget({ kind: 'program', applicationId })
        }
      }
      if (!actions.m && section && nextPageArgs(findResultRecord(storeRef.current, view.source))) {
        actions.m = () => loadMore(section.id, itemId, view)
      }
      if (!actions.a && view.view === 'account.portfolio') {
        const filter = transactionsFilterFor(storeRef.current, view)
        if (filter?.address) {
          const { address } = filter
          actions.a = () => openTarget({ kind: 'holdings', address })
        }
      }
    }
    return actions
  }, [feed.cursorItemId, loadMore, openTarget, sections, selectedId, storeRef])
  const runCardAction = useCallback((key: 't' | 'e' | 'm' | 'a') => cardActions[key]?.(), [cardActions])

  const closeSelectedSection = useCallback(() => {
    feed.closeSelectedSection(
      (sectionId) => !isFlowSection(sectionId),
      () => setStatus('Finish or deny the payment before closing its section.'),
    )
  }, [feed.closeSelectedSection, isFlowSection])
  const closeSection = useCallback(
    (id: number) => {
      feed.markSection(id)
      closeSelectedSection()
    },
    [closeSelectedSection, feed.markSection],
  )

  const submit = useCallback(
    (raw: string) => {
      setInputEpoch((epoch) => epoch + 1)
      const trimmed = raw.trim()
      if (trimmed === '') return
      const outcome = routeComposerInput(trimmed)
      // Navigation-only inputs don't earn a section.
      if (outcome.status === 'nav') {
        openWorkspace(outcome.screen)
        return
      }
      const sectionId = createSection(trimmed)
      switch (outcome.status) {
        case 'payment':
          startPayment(sectionId, outcome.amountMicroAlgos, outcome.to)
          return
        case 'transaction':
          openTransaction(sectionId, outcome.txid)
          return
        case 'group':
          openGroup(sectionId, outcome.groupId)
          return
        case 'account':
          openAccount(sectionId, outcome.address)
          return
        case 'account-name':
          openAccountName(sectionId, outcome.name)
          return
        case 'account-list':
          openMyAccounts(sectionId)
          return
        case 'asset':
          openAsset(sectionId, outcome.assetId)
          return
        case 'application':
          openApplication(sectionId, outcome.applicationId)
          return
        case 'block':
          openBlock(sectionId, outcome.round)
          return
        case 'network':
          if (outcome.network) switchNetwork(outcome.network, sectionId)
          else {
            appendNote(
              sectionId,
              `You're on ${networkRef.current}. Use "network localnet|testnet|mainnet" or ctrl+n to switch.`,
            )
          }
          return
        case 'help':
          appendNote(sectionId, HELP)
          return
        case 'ambiguous':
          openAmbiguous(sectionId, outcome.value)
          return
        case 'text':
          runAgent(sectionId, outcome.text)
      }
    },
    [
      appendNote,
      createSection,
      networkRef,
      openAccount,
      openAccountName,
      openWorkspace,
      openAmbiguous,
      openMyAccounts,
      openApplication,
      openAsset,
      openBlock,
      openGroup,
      openTransaction,
      runAgent,
      startPayment,
      switchNetwork,
    ],
  )

  const width = dimensions.width
  const height = dimensions.height
  const isNarrow = width < 96

  useExplorerKeys({
    feed,
    modalOpen,
    decide,
    switchNetwork,
    openWorkspace,
    screen,
    setScreen,
    accountList,
    setActiveSender,
    cycleAccount,
    closeSelectedSection,
    appsDetailOpen: apps.selected !== null,
    closeAppsDetail,
    activateAppsEntry,
    appsMethodOpen: apps.selectedMethod !== null,
    selectAppsMethod,
    submitAppsCall: apps.submitCall,
    toggleBlocksTail: tail.togglePause,
    openListRow,
    runCardAction,
    toggleNav,
  })

  const navWidth = Math.min(34, Math.max(24, Math.floor(width * 0.24)))
  const modeLabel = live === 'probing' ? 'probing…' : live ? 'live' : 'sample data'
  const senderAccount = accountList.find((account) => account.address === activeSender)
  const composerFocused = screen === 'chat' && !modalOpen && focus === 'composer'
  const reclaimFocus = useCallback(() => {
    if (composerFocused) composerRef.current?.focus()
    else if (screen === 'apps' && apps.selectedMethod) methodInputRef.current?.focus()
  }, [apps.selectedMethod, composerFocused, screen])
  const showNav = navOpen && !isNarrow && screen === 'chat'
  const hint =
    agentBusy || busy
      ? 'working…'
      : agentConfig
        ? 'Ask anything, or: ^w wallet · pay 0.5 to <label> · paste an ID or name.algo'
        : '^w wallet · ^1 assets · pay 0.5 to <label> · paste an ID or name.algo'

  // One grammar everywhere: `key verb`, dots between, no brackets; drawn in
  // the active pane's bottom frame line. Global keys live in the masthead.
  const keybar = modalOpen
    ? 'enter approve · esc deny'
    : screen === 'wallet'
      ? '1-9 select · esc explore'
      : screen === 'apps'
        ? apps.selectedMethod
          ? 'enter simulate · esc methods'
          : apps.selected
            ? '1-9 method · esc apps'
            : '1-9 open · ←/→ account · esc explore'
      : screen === 'blocks'
        ? `space ${tail.running ? 'stop' : 'start'} · esc explore`
      : screen === 'assets' || screen === 'txns'
        ? '←/→ account · esc explore'
        : focus === 'content'
          ? [
              '↑/↓ scroll',
              '←/→ cards',
              cardActions.rows ? '1-9 open row' : null,
              cardActions.t ? 't txns' : null,
              cardActions.a ? 'a assets' : null,
              cardActions.e ? 'e explain' : null,
              cardActions.m ? 'm more' : null,
              'x close',
              'tab/esc composer',
            ]
              .filter(Boolean)
              .join(' · ')
          : sections.length > 0
            ? `enter send · tab feed (${sections.length}) · ^s session · ^n network · ctrl+c quit`
            : 'enter send · drag copies · ^n network · ctrl+c quit'

  return (
    <CopyContext.Provider value={copyIdent}>
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={COLORS.background}
      onMouseUp={reclaimFocus}
    >
      <TopBar
        screen={screen}
        modeLabel={modeLabel}
        live={live}
        network={network}
        latestRound={tail.latestRound}
        accountName={senderAccount?.name}
        address={activeSender}
        width={width}
        onOpenChat={() => {
          setScreen('chat')
          setFocus('composer')
        }}
        onOpenWallet={() => openWorkspace('wallet')}
        onOpenScreen={openWorkspace}
        onSwitchNetwork={() => switchNetwork()}
      />
      {screen === 'wallet' ? (
        <WalletScreen
          accounts={accountList}
          loading={accounts.accountsLoading}
          signer={accounts.signer}
          network={network}
          balances={accounts.balances}
          activeSender={activeSender}
          width={width}
          onSelect={setActiveSender}
          keys={keybar}
        />
      ) : screen === 'apps' ? (
        <AppsScreen
          network={network}
          entries={apps.entries}
          selected={apps.selected}
          selectedMethod={apps.selectedMethod}
          sender={activeSender}
          optedInLoading={apps.optedInLoading}
          width={width}
          onActivate={activateAppsEntry}
          onSelectMethod={apps.selectMethod}
          callEpoch={apps.callEpoch}
          callBusy={apps.callBusy}
          callError={apps.callError}
          callResult={apps.callResult}
          onInput={apps.setCallInput}
          onSubmit={apps.submitCall}
          inputRef={methodInputRef}
          keys={keybar}
        />
      ) : screen === 'blocks' ? (
        <BlocksScreen
          network={network}
          live={live}
          running={tail.running}
          paused={tail.paused}
          latestRound={tail.latestRound}
          error={tail.error}
          store={store}
          views={tail.views}
          width={width}
          onToggle={tail.togglePause}
          onOpen={openTarget}
          keys={keybar}
        />
      ) : screen === 'assets' || screen === 'txns' ? (
        <ShelfScreen
          title={screen === 'assets' ? 'ASSETS' : 'TRANSACTIONS'}
          accountName={senderAccount?.name}
          address={activeSender}
          loading={accounts.shelfLoading}
          error={accounts.shelfError}
          empty={screen === 'assets' ? 'No assets on this account.' : 'No transactions yet.'}
          store={store}
          view={accounts.shelfView}
          width={width}
          onOpen={openTarget}
          onMore={accounts.loadMoreShelf}
          loadingMore={accounts.shelfLoadingMore}
          keys={keybar}
        />
      ) : (
        <box flexGrow={1} flexDirection="row">
          {showNav ? (
            <NavPane
              sections={sections}
              selectedId={selectedId}
              width={navWidth}
              onSelect={feed.selectSection}
            />
          ) : null}
          <ContentPane
            sections={sections}
            selectedId={selectedId}
            store={store}
            focused={focus === 'content'}
            busyPayment={busy && flow !== null}
            liveThinkingSectionId={agentBusy ? agentSectionRef.current : null}
            hasAgent={Boolean(agentConfig)}
            keys={keybar}
            width={showNav ? width - navWidth : width}
            scrollRef={feed.contentScrollRef}
            sectionRegistry={feed.sectionRegistry}
            onSelect={feed.markSection}
            onToggleThinking={feed.toggleThinking}
            onOpen={openTarget}
            onClose={closeSection}
            onMore={loadMore}
            onSuggest={(text) => {
              if (composerRef.current) composerRef.current.value = text
              setFocus('composer')
            }}
            loadingMoreItemId={loadingMoreItemId}
            cursorItemId={feed.cursorItemId}
            cardRegistry={feed.cardRegistry}
            onSelectItem={feed.setCursor}
          />
        </box>
      )}
      <text
        height={1}
        paddingX={1}
        fg={COLORS.muted}
        content={status === '' ? ' ' : shorten(status, width - 4)}
      />
      {screen === 'chat' ? (
        <Composer
          epoch={inputEpoch}
          focused={composerFocused}
          hint={hint}
          inputRef={composerRef}
          onFocus={() => setFocus('composer')}
          onSubmit={submit}
        />
      ) : null}
      {approvalOpen ? (
        <ApprovalModal model={modalModel} network={network} screenWidth={width} screenHeight={height} />
      ) : null}
      {confirm ? (
        <ConfirmModal
          title={`AGENT ▸ ${network.toUpperCase()}`}
          kicker={confirm.title}
          lines={confirm.lines}
          screenWidth={width}
          screenHeight={height}
        />
      ) : null}
    </box>
    </CopyContext.Provider>
  )
}
