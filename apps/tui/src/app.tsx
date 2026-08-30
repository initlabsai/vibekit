import { createFixtureResultStore } from '@initlabs/vibekit/views/sample'
import { type ResultStore, type ViewSpec } from '@initlabs/vibekit/actions'
import { draftRecordFromComposeWire } from '@initlabs/vibekit/actions'
import { type LiveNetworkId } from '@initlabs/vibekit/views'
import type { InputRenderable } from '@opentui/core'
import { useTerminalDimensions } from '@opentui/react'
import { useCallback, useMemo, useRef, useState } from 'react'

import { loadStoredPlugins, saveStoredPlugins } from '@initlabs/vibekit/agent'

import { routeComposerInput } from './commands.js'
import { CopyContext, useCopyOnSelect } from './copy-selection.js'
import { useAccounts } from './features/accounts/hooks.js'
import { AccountListScreen } from './features/accounts/list-screen.js'
import { WalletScreen } from './features/accounts/wallet-screen.js'
import { useAgentLane } from './features/agent/hooks.js'
import { EXPLORER_PLUGIN_INFO } from './features/agent/session.js'
import { useApps } from './features/apps/hooks.js'
import type { AppsKeys } from './features/apps/keys.js'
import { AppsScreen } from './features/apps/screen.js'
import { useBlockTail } from './features/blocks/hooks.js'
import { BlocksScreen } from './features/blocks/screen.js'
import { NETWORKS, useNetwork } from './features/network/hooks.js'
import { PluginsScreen } from './features/plugins/screen.js'
import { ApprovalModal, ConfirmModal } from './features/action/approval-modal.js'
import { useAction } from './features/action/hooks.js'
import { Composer, ContentPane, NavPane } from './feed/feed.js'
import { useFeed } from './feed/hooks.js'
import { cardActionsFor, keybarFor, listRowTxid, useExplorerKeys } from './keys.js'
import { loadNextPage, useLookups } from './lookup.js'
import type { OpenTarget } from './result-card.js'
import { COLORS, errorMessage, shorten } from './theme.js'
import { TopBar, type Screen } from './top-bar.js'

const HELP = 'pay 0.5 to <label|address> · blocks · list my accounts · alice.algo · paste an id'

/**
 * The Explorer as a chat-first transcript plus results feed: a session index
 * on the left (one line per request) and a sticky-bottom feed on the right
 * where each request's narration, cards, and errors accrete as a group.
 * Tab hands focus to the feed; a write approval is a true modal over
 * everything.
 *
 * This component is the composition root: each feature lives under
 * `features/<name>/` (hooks.ts, screen.tsx, cards.tsx), the transcript under
 * `feed/`, and the genuinely shared state (result store, screen, busy flags,
 * status line) stays here and is passed into the hooks as parameters. Hooks
 * are called in dependency order; none reaches forward through a ref.
 */
export function App() {
  const dimensions = useTerminalDimensions()

  // Shared state: the trusted result store, the screen, and the cross-lane busy flags.
  const [store, setStore] = useState<ResultStore>(createFixtureResultStore)
  const [screen, setScreen] = useState<Screen>('chat')
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
  const [confirm, setConfirm] = useState<{
    title: string
    lines: string[]
    resolve: (ok: boolean) => void
  } | null>(null)
  // Plugin enablement: config is truth at startup, state mirrors it for the session.
  const [disabledPlugins, setDisabledPlugins] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        Object.entries(loadStoredPlugins())
          .filter(([, enabled]) => !enabled)
          .map(([name]) => name),
      ),
  )
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

  const { network, networkRef, keystoreHost, host, live, setNetwork } = useNetwork()

  const feed = useFeed()
  const { focus, setFocus, sections, selectedId, appendNote, createSection } = feed

  const accounts = useAccounts({
    keystoreHost,
    host,
    network,
    screen,
    setScreen,
    commitStore,
    storeRef,
    setFocus,
  })
  const { signerReady, activeSender, setActiveSender, accountList, cycleAccount, openScreen } =
    accounts

  const payment = useAction({
    feed,
    store,
    storeRef,
    commitStore,
    host,
    keystoreHost,
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
  const {
    flow,
    flowRef,
    startPayment,
    startFromDraft,
    decide: decidePayment,
    isFlowSection,
    modalOpen: paymentModalOpen,
    modalModel,
  } = payment

  /** A method-line call or deploy composed a group: review it in the feed. */
  const onAppsDraft = useCallback(
    (wire: unknown, toolName: string, label: string) => {
      if (flowRef.current !== null) return 'A write is already awaiting approval.'
      // Ids come from the session counter: the store rejects a repeated tool-call id.
      const draftRecord = draftRecordFromComposeWire(
        { resultId: newId('result-apps-draft'), toolCallId: newId('tool-call-apps'), network },
        wire,
        toolName,
      )
      setScreen('chat')
      startFromDraft(
        createSection(`call ${label}`),
        draftRecord,
        'typed',
        "Couldn't prepare the call",
      )
      return undefined
    },
    [createSection, flowRef, network, newId, startFromDraft],
  )
  const apps = useApps({ screen, network, sender: activeSender, live, host, onDraft: onAppsDraft })
  const agentExtraTools = apps.extraTools

  const lookup = useLookups({
    feed,
    host,
    accountList,
    commitStore,
    storeRef,
    networkRef,
    busyRef,
    setBusy,
    setStatus,
    specCatalog: apps.catalog,
    disabledPlugins,
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

  // One modal at a time: the write approval or an expensive-call confirm.
  // An agent-composed write waits for the turn to end, so its one-line
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

  const tail = useBlockTail({ live, host, network, screen, commitStore, storeRef })

  const switchNetwork = useCallback(
    (target?: LiveNetworkId, sectionId?: number) => {
      const report = (text: string, tone: 'muted' | 'error' = 'muted') => {
        if (sectionId !== undefined) appendNote(sectionId, text, tone)
        else setStatus(text)
      }
      if (flowRef.current !== null) {
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
    [appendNote, flowRef, networkRef, setNetwork],
  )

  const agent = useAgentLane({
    feed,
    payment,
    network,
    networkRef,
    activeSender,
    accountList,
    commitStore,
    storeRef,
    newId,
    agentBusy,
    setAgentBusy,
    setStatus,
    extraTools: agentExtraTools,
    specCatalog: apps.catalog,
    specHashCatalog: apps.hashCatalog,
    disabledPlugins,
    onNetworkUsed: switchNetwork,
    askConfirm,
  })
  const { agentConfig, runAgent, agentSectionRef } = agent

  /** Flips one plugin and persists the map; the agent session rebuilds on its next turn. */
  const togglePlugin = useCallback(
    (name: string) => {
      const next = new Set(disabledPlugins)
      if (!next.delete(name)) next.add(name)
      setDisabledPlugins(next)
      saveStoredPlugins(Object.fromEntries([...next].map((disabled) => [disabled, false])))
    },
    [disabledPlugins],
  )

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
    [
      createSection,
      openAccount,
      openApplication,
      openAsset,
      openBlock,
      openHoldings,
      openTransaction,
      openTransactions,
      runAgent,
    ],
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
        .catch((error: unknown) =>
          appendNote(sectionId, `Couldn't load more — ${errorMessage(error)}`, 'error'),
        )
        .finally(() => setLoadingMoreItemId(null))
    },
    [appendNote, commitStore, feed.replaceBlockView, host, loadingMoreItemId, networkRef, storeRef],
  )

  const cardActions = useMemo(
    () =>
      cardActionsFor({
        sections,
        selectedId,
        cursorItemId: feed.cursorItemId,
        store,
        openTarget,
        loadMore,
      }),
    [feed.cursorItemId, loadMore, openTarget, sections, selectedId, store],
  )
  const runCardAction = useCallback(
    (key: 't' | 'e' | 'm' | 'a') => cardActions[key]?.(),
    [cardActions],
  )
  const openListRow = useCallback(
    (index: number) => {
      const txid = listRowTxid({
        sections,
        selectedId,
        cursorItemId: feed.cursorItemId,
        store: storeRef.current,
        index,
      })
      if (txid) openTarget({ kind: 'transaction', txid })
    },
    [feed.cursorItemId, openTarget, sections, selectedId, storeRef],
  )

  const closeSelectedSection = useCallback(() => {
    feed.closeSelectedSection(
      (sectionId) => !isFlowSection(sectionId),
      () => setStatus('Finish or deny the write before closing its section.'),
    )
  }, [feed.closeSelectedSection, isFlowSection])
  const closeSection = useCallback(
    (id: number) => {
      feed.markSection(id)
      closeSelectedSection()
    },
    [closeSelectedSection, feed.markSection],
  )

  /** The apps screen's keys: card and method selection, and opening an app's record in the feed. */
  const appsKeys = useMemo<AppsKeys>(
    () => ({
      detailOpen: apps.selected !== null,
      methodOpen: apps.selectedMethod !== null || apps.deployOpen,
      close: apps.closeDetail,
      activate: (index) => {
        const group = apps.groups[index - 1]
        if (!group) return
        const appId = group.deployed[0]?.appId ?? group.optedIn[0]
        if (group.spec) {
          apps.selectSpec({ group, spec: group.spec, ...(appId === undefined ? {} : { appId }) })
          return
        }
        // On-chain only, no spec to render: the same lane as `app <id>`.
        if (appId === undefined) return
        setScreen('chat')
        openApplication(createSection(`app ${appId}`), appId)
      },
      selectMethod: (index) => {
        const method = apps.selected?.spec.spec.methods[index - 1]
        if (method) apps.selectMethod(method)
      },
      submit: apps.submitCall,
      open: () => {
        const appId = apps.selected?.appId
        if (appId === undefined) return
        setScreen('chat')
        openApplication(createSection(`app ${appId}`), appId)
      },
      deploy: apps.startDeploy,
      cycleAccount,
    }),
    [apps, createSection, cycleAccount, openApplication],
  )

  const submit = useCallback(
    (raw: string) => {
      setInputEpoch((epoch) => epoch + 1)
      const trimmed = raw.trim()
      if (trimmed === '') return
      const outcome = routeComposerInput(trimmed)
      // Navigation-only inputs don't earn a section.
      if (outcome.status === 'nav') {
        openScreen(outcome.screen)
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
      openScreen,
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
    openScreen,
    screen,
    setScreen,
    accountList,
    setActiveSender,
    cycleAccount,
    closeSelectedSection,
    apps: appsKeys,
    toggleBlocksTail: tail.togglePause,
    togglePlugin: (index) => {
      const info = EXPLORER_PLUGIN_INFO[index - 1]
      if (info) togglePlugin(info.name)
    },
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
    else if (screen === 'apps' && (apps.selectedMethod || apps.deployOpen))
      methodInputRef.current?.focus()
  }, [apps.deployOpen, apps.selectedMethod, composerFocused, screen])
  const showNav = navOpen && !isNarrow && screen === 'chat'
  const hint =
    agentBusy || busy
      ? 'working…'
      : agentConfig
        ? 'Ask anything, or: ^w wallet · pay 0.5 to <label> · paste an ID or name.algo'
        : '^w wallet · ^1 assets · pay 0.5 to <label> · paste an ID or name.algo'
  const keybar = keybarFor({
    modalOpen,
    screen,
    focus,
    apps,
    tailRunning: tail.running,
    cardActions,
    sectionCount: sections.length,
  })

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
          onOpenWallet={() => openScreen('wallet')}
          onOpenScreen={openScreen}
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
            groups={apps.groups}
            accountName={senderAccount?.name}
            selected={apps.selected}
            selectedMethod={apps.selectedMethod}
            deployOpen={apps.deployOpen}
            sender={activeSender}
            deployedLoading={apps.deployedLoading}
            deployedError={apps.deployedError}
            optedInLoading={apps.optedInLoading}
            globalState={apps.globalState}
            width={width}
            onActivate={appsKeys.activate}
            onOpenApp={appsKeys.open}
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
        ) : screen === 'plugins' ? (
          <PluginsScreen
            plugins={EXPLORER_PLUGIN_INFO.map((info) => ({
              ...info,
              enabled: !disabledPlugins.has(info.name),
            }))}
            width={width}
            onToggle={togglePlugin}
            keys={keybar}
          />
        ) : screen === 'assets' || screen === 'txns' ? (
          <AccountListScreen
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
              status={status}
            />
          </box>
        )}
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
          <ApprovalModal
            model={modalModel}
            network={network}
            origin={payment.flowOrigin}
            screenWidth={width}
            screenHeight={height}
          />
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
