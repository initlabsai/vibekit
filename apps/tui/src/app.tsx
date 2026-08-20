import {
  addResult,
  createAccountListViewModel,
  createAccountPortfolioViewModel,
  createApplicationDetailViewModel,
  createAssetDetailViewModel,
  createBlockDetailViewModel,
  createFixturePaymentHost,
  createFixtureResultStore,
  createPaymentFlowViewModel,
  createTransactionCollectionViewModel,
  createTransactionDetailViewModel,
  formatMicroAlgos,
  FIXTURE_ADDRESS_BOOK,
  FIXTURE_SENDER,
  FIXTURE_TRANSACTION_ID,
  PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  PAYMENT_FIXTURE_TRANSACTION_ID,
  bridgeToolResult,
  lookupAmbiguousEntity,
  paymentComposeFromToolResult,
  performLivePaymentStep,
  startPaymentFlow,
  startPaymentFlowFromDraftRecord,
  completeApprovedPaymentFlow,
  EXPERIENCE_PROTOCOL_VERSION,
  type ResultStore,
  type StructuredResult,
  type TrustedViewId,
  type ViewSpec,
  type WriteFlowState,
} from '@initlabs/vibekit-experience'
import { draftRecordFromComposeWire, type LiveNetworkId } from '@initlabs/vibekit-experience/live'
import type { AgentSession } from '@initlabs/vibekit-agent'
import type {
  BoxRenderable,
  ScrollBoxRenderable,
  SubmitEvent as OpenTUISubmitEvent,
} from '@opentui/core'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createExplorerAgent, loadAgentConfig, runAgentTurn } from './agent-lane.js'
import { ApprovalModal } from './approval-modal.js'
import { nextAssetSort } from './cards.js'
import {
  ShelfScreen,
  TopBar,
  WalletScreen,
  type WorkspaceScreen,
} from './chrome.js'
import { paymentParties, routeComposerInput } from './commands.js'
import { CopyContext, useCopyOnSelect } from './copy-selection.js'
import { createKeystorePaymentHost, type KeystorePaymentHost } from './keystore-host.js'
import {
  ContentPane,
  NavPane,
  type Section,
  type SectionBlock,
  type SectionItem,
} from './sections.js'
import { COLORS, shorten } from './theme.js'

const HELP = 'pay 0.5 · list my accounts · sample · paste an id'

const NETWORKS: LiveNetworkId[] = ['localnet', 'testnet', 'mainnet']

type Focus = 'composer' | 'nav' | 'content'

function viewFor(record: StructuredResult, view: TrustedViewId): ViewSpec {
  return {
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'view',
    view,
    source: { source: 'result', id: record.resultId },
  } as ViewSpec
}

function Composer({
  epoch,
  focused,
  hint,
  onChange,
  onSubmit,
}: {
  epoch: number
  focused: boolean
  hint: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
}) {
  // OpenTUI's intrinsic type currently intersects its core SubmitEvent prop
  // with the React adapter's string callback; runtime behavior is the latter.
  const submitHandler = onSubmit as unknown as ((event: OpenTUISubmitEvent) => void) &
    ((value: string) => void)

  return (
    <box
      height={3}
      flexDirection="row"
      alignItems="center"
      paddingX={1}
      border
      borderStyle="rounded"
      borderColor={focused ? COLORS.brass : COLORS.border}
      backgroundColor={COLORS.panelRaised}
    >
      <text fg={focused ? COLORS.brassBright : COLORS.faint}>› </text>
      {/* Remount per submit: the input keeps its own buffer, so a fresh key is
          the only reliable way to clear it. */}
      <input
        key={epoch}
        flexGrow={1}
        focused={focused}
        placeholder={hint}
        onInput={onChange}
        onSubmit={submitHandler}
      />
    </box>
  )
}

/**
 * The Explorer as a chat-first transcript plus results feed: a session index
 * on the left (one line per request) and a sticky-bottom feed on the right
 * where each request's narration, cards, and errors accrete as a group.
 * Tab hands focus to the feed; a payment decision is a true modal over
 * everything.
 */
export function App() {
  const hostCache = useRef(new Map<LiveNetworkId, KeystorePaymentHost>())
  const hostFor = useCallback((net: LiveNetworkId): KeystorePaymentHost => {
    let cached = hostCache.current.get(net)
    if (!cached) {
      cached = createKeystorePaymentHost(net)
      hostCache.current.set(net, cached)
    }
    return cached
  }, [])
  const [network, setNetwork] = useState<LiveNetworkId>('localnet')
  const networkRef = useRef<LiveNetworkId>(network)
  networkRef.current = network
  const keystoreHost = hostFor(network)
  const sampleHost = useMemo(() => createFixturePaymentHost(), [])
  const dimensions = useTerminalDimensions()
  const [live, setLive] = useState<'probing' | boolean>('probing')
  const [signerReady, setSignerReady] = useState(false)
  const [activeSender, setActiveSender] = useState<string | undefined>(FIXTURE_SENDER)
  const [store, setStore] = useState<ResultStore>(createFixtureResultStore)
  const [sections, setSections] = useState<Section[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [focus, setFocus] = useState<Focus>('composer')
  const [flow, setFlow] = useState<WriteFlowState | null>(null)
  const [flowMode, setFlowMode] = useState<'live' | 'sample'>('sample')
  const [busy, setBusy] = useState(false)
  const [agentBusy, setAgentBusy] = useState(false)
  const [screen, setScreen] = useState<WorkspaceScreen>('chat')
  const [shelfView, setShelfView] = useState<ViewSpec | undefined>()
  const [shelfError, setShelfError] = useState<string | undefined>()
  const [shelfLoading, setShelfLoading] = useState(false)
  const [accountList, setAccountList] = useState<ReadonlyArray<{ address: string; name?: string }>>(
    [],
  )
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [status, setStatus] = useState('')
  const copyIdent = useCopyOnSelect((text) =>
    setStatus(`copied ${shorten(text.replace(/\s+/g, ' '), 28)}`),
  )
  const [inputEpoch, setInputEpoch] = useState(0)
  const [, setInput] = useState('')

  const sectionSeq = useRef(0)
  const itemSeq = useRef(0)
  const storeRef = useRef<ResultStore>(store)
  const sectionsRef = useRef<Section[]>(sections)
  const selectedRef = useRef<number | null>(selectedId)
  const flowRef = useRef<WriteFlowState | null>(flow)
  const flowSectionRef = useRef<number | null>(null)
  const flowItemRef = useRef<number | null>(null)
  const agentSectionRef = useRef<number | null>(null)
  const agentHasCardsRef = useRef(false)
  const agentRef = useRef<AgentSession | null>(null)
  const contentScrollRef = useRef<ScrollBoxRenderable | null>(null)
  const sectionRegistry = useRef(new Map<number, BoxRenderable>())
  storeRef.current = store
  sectionsRef.current = sections
  selectedRef.current = selectedId
  flowRef.current = flow

  useEffect(() => {
    let cancelled = false
    setLive('probing')
    keystoreHost.probe().then((reachable) => {
      if (!cancelled) setLive(reachable)
    })
    keystoreHost
      .listSigningAccounts()
      .then((accounts) => {
        if (cancelled) return
        setSignerReady(accounts.length > 0)
        setAccountList(accounts)
        setActiveSender((current) =>
          current && accounts.some((account) => account.address === current)
            ? current
            : (accounts[0]?.address ?? FIXTURE_SENDER),
        )
      })
      .catch(() => {
        if (cancelled) return
        setSignerReady(false)
        setAccountList([...FIXTURE_ADDRESS_BOOK])
        setActiveSender(FIXTURE_SENDER)
      })
    return () => {
      cancelled = true
    }
  }, [keystoreHost])

  const newId = useCallback((prefix: string) => `${prefix}-${crypto.randomUUID()}`, [])
  const host = useCallback(
    () => (live === true ? keystoreHost : sampleHost),
    [keystoreHost, live, sampleHost],
  )

  const commitStore = useCallback((next: ResultStore) => {
    storeRef.current = next
    setStore(next)
  }, [])

  const commitSections = useCallback((next: Section[]) => {
    sectionsRef.current = next
    setSections(next)
  }, [])

  const newItemId = useCallback(() => {
    itemSeq.current += 1
    return itemSeq.current
  }, [])

  /** Jumps a feed group into view (nav click, enter, ←/→). New groups rely on sticky-bottom instead. */
  const scrollToSection = useCallback((id: number) => {
    const attempt = () => {
      const target = sectionRegistry.current.get(id)
      const scroll = contentScrollRef.current
      if (!target || !scroll) return false
      const offset = scroll.scrollTop + (target.y - scroll.viewport.y)
      scroll.scrollTo({ x: 0, y: Math.max(0, offset) })
      return true
    }
    if (!attempt()) setTimeout(attempt, 50)
  }, [])

  /** Highlights a feed group without moving the viewport. Used on content clicks so a drag-select does not jump. */
  const markSection = useCallback((id: number) => {
    setSelectedId(id)
    selectedRef.current = id
  }, [])

  const selectSection = useCallback(
    (id: number) => {
      markSection(id)
      scrollToSection(id)
    },
    [markSection, scrollToSection],
  )

  /** Creates the section for one user request and returns its id. */
  const createSection = useCallback(
    (prompt: string): number => {
      sectionSeq.current += 1
      const id = sectionSeq.current
      commitSections([...sectionsRef.current, { id, prompt, sort: 'none', items: [] }])
      setSelectedId(id)
      selectedRef.current = id
      return id
    },
    [commitSections],
  )

  const appendItem = useCallback(
    (sectionId: number, item: SectionItem) => {
      commitSections(
        sectionsRef.current.map((section) =>
          section.id === sectionId ? { ...section, items: [...section.items, item] } : section,
        ),
      )
    },
    [commitSections],
  )

  const patchSection = useCallback(
    (sectionId: number, patch: Partial<Section>) => {
      commitSections(
        sectionsRef.current.map((section) =>
          section.id === sectionId ? { ...section, ...patch } : section,
        ),
      )
    },
    [commitSections],
  )

  const toggleThinking = useCallback(
    (sectionId: number) => {
      commitSections(
        sectionsRef.current.map((section) =>
          section.id === sectionId ? { ...section, thinkingOpen: !section.thinkingOpen } : section,
        ),
      )
    },
    [commitSections],
  )

  const appendNote = useCallback(
    (sectionId: number, text: string, tone: 'muted' | 'error' | 'agent' = 'muted') => {
      appendItem(sectionId, { id: newItemId(), kind: 'note', text, tone })
    },
    [appendItem, newItemId],
  )

  const appendBlock = useCallback(
    (sectionId: number, block: SectionBlock): number => {
      const id = newItemId()
      appendItem(sectionId, { id, kind: 'block', block })
      return id
    },
    [appendItem, newItemId],
  )

  const updateFlowBlock = useCallback(
    (nextFlow: WriteFlowState) => {
      flowRef.current = nextFlow
      setFlow(nextFlow)
      const targetSection = flowSectionRef.current
      const targetItem = flowItemRef.current
      if (targetSection === null || targetItem === null) return
      commitSections(
        sectionsRef.current.map((section) =>
          section.id === targetSection
            ? {
                ...section,
                items: section.items.map((item) =>
                  item.id === targetItem && item.kind === 'block' && item.block.kind === 'payment'
                    ? { ...item, block: { ...item.block, flow: nextFlow } }
                    : item,
                ),
              }
            : section,
        ),
      )
    },
    [commitSections],
  )

  const finishPayment = useCallback(
    (finalFlow: WriteFlowState | null, message: string, tone: 'muted' | 'error' = 'muted') => {
      if (finalFlow) updateFlowBlock(finalFlow)
      const sectionId = flowSectionRef.current
      flowRef.current = null
      flowSectionRef.current = null
      flowItemRef.current = null
      setFlow(null)
      setBusy(false)
      setStatus('')
      if (sectionId !== null) appendNote(sectionId, message, tone)
    },
    [appendNote, updateFlowBlock],
  )

  const trackFlowStep = useCallback(
    (sectionId: number) => (nextStore: ResultStore, nextFlow: WriteFlowState) => {
      commitStore(nextStore)
      if (flowSectionRef.current === null) {
        flowSectionRef.current = sectionId
        flowItemRef.current = appendBlock(sectionId, { id: 0, kind: 'payment', flow: nextFlow })
        flowRef.current = nextFlow
        setFlow(nextFlow)
      } else {
        updateFlowBlock(nextFlow)
      }
    },
    [appendBlock, commitStore, updateFlowBlock],
  )

  const startPayment = useCallback(
    (sectionId: number, amountMicroAlgos?: number) => {
      if (busy || flowRef.current !== null) {
        appendNote(sectionId, 'A payment is already in progress.', 'error')
        return
      }
      const useLive = live === true
      setFlowMode(useLive ? 'live' : 'sample')
      setBusy(true)
      setStatus(
        useLive
          ? `composing and simulating on ${networkRef.current}…`
          : `preparing a sample payment (always 0.25 ALGO — ${networkRef.current} is offline)…`,
      )
      void startPaymentFlow({
        host: host(),
        store: storeRef.current,
        draftParams: {
          ...paymentParties(accountList, activeSender),
          amountMicroAlgos: amountMicroAlgos ?? PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
          note: 'Explorer live payment',
        },
        newId,
        onStep: trackFlowStep(sectionId),
      }).then((run) => {
        commitStore(run.store)
        setBusy(false)
        if (!run.ok) {
          finishPayment(run.flow, `Couldn't prepare the payment — ${run.message}`, 'error')
          return
        }
        if (run.flow) updateFlowBlock(run.flow)
        setStatus('')
      })
    },
    [
      accountList,
      activeSender,
      appendNote,
      busy,
      commitStore,
      finishPayment,
      host,
      live,
      newId,
      trackFlowStep,
      updateFlowBlock,
    ],
  )

  const decide = useCallback(
    (decision: 'approve' | 'deny') => {
      const current = flowRef.current
      const sectionId = flowSectionRef.current
      if (busy || !current || current.stage !== 'awaiting-approval' || sectionId === null) return
      setBusy(true)
      void performLivePaymentStep({
        host: host(),
        store: storeRef.current,
        flow: current,
        kind: decision,
        newId,
      }).then((outcome) => {
        if (!outcome.ok) {
          setBusy(false)
          appendNote(sectionId, `Couldn't ${decision} — ${outcome.message}`, 'error')
          return
        }
        commitStore(outcome.store)
        updateFlowBlock(outcome.flow)
        if (decision === 'deny') {
          finishPayment(outcome.flow, 'Denied — nothing was signed.')
          return
        }
        setStatus(flowMode === 'live' ? 'signing and submitting…' : 'finishing the sample…')
        void completeApprovedPaymentFlow({
          host: host(),
          store: outcome.store,
          flow: outcome.flow,
          newId,
          onStep: (nextStore, nextFlow) => {
            commitStore(nextStore)
            updateFlowBlock(nextFlow)
          },
        }).then((run) => {
          commitStore(run.store)
          if (!run.ok) {
            finishPayment(run.flow, `Approved, but completion failed — ${run.message}`, 'error')
            return
          }
          if (run.pausedForSigner) {
            finishPayment(
              run.flow,
              'Approved — signing is unavailable without the keystore daemon.',
            )
            return
          }
          const derived =
            run.flow && run.flow.stage === 'confirmed'
              ? createPaymentFlowViewModel(run.store, run.flow)
              : undefined
          const round =
            derived && derived.ok ? derived.model.confirmation?.confirmedRound : undefined
          finishPayment(
            run.flow,
            `Payment confirmed on-chain${round === undefined ? '' : ` in round ${round}`}.`,
          )
        })
      })
    },
    [appendNote, busy, commitStore, finishPayment, flowMode, host, newId, updateFlowBlock],
  )

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
    [appendBlock, appendNote, busy, commitStore, host],
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
    [appendBlock, appendNote, busy, commitStore, host],
  )

  const presentRecord = useCallback(
    (sectionId: number, record: StructuredResult, view: TrustedViewId) => {
      commitStore(addResult(storeRef.current, record))
      appendBlock(sectionId, { id: 0, kind: 'view', view: viewFor(record, view) })
    },
    [appendBlock, commitStore],
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
    [appendNote, busy, host, keystoreHost, presentRecord, signerReady],
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
    [appendNote, busy, presentRecord],
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
    [host, lookupById],
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
    [host, lookupById],
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
    [host, lookupById],
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
    [host, lookupById],
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
    [appendNote, busy, host, presentRecord],
  )

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
      agentRef.current = null
      setNetwork(next)
      report(`Switched to ${next}. Existing sections keep their original network.`)
    },
    [appendNote],
  )

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
  }, [keystoreHost, signerReady])

  const loadShelf = useCallback(
    (target: Exclude<WorkspaceScreen, 'chat' | 'wallet'>, address: string | undefined) => {
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
          : target === 'apps'
            ? () => host().lookupAccountAppStates(address)
            : () => host().lookupAccountTransactions(address)
      const viewId =
        target === 'assets'
          ? ('asset.list' as const)
          : target === 'apps'
            ? ('application.state' as const)
            : ('transaction.list' as const)
      void run()
        .then((record) => {
          const nextStore = addResult(storeRef.current, record)
          commitStore(nextStore)
          setShelfView(viewFor(record, viewId))
          setShelfLoading(false)
        })
        .catch((error: unknown) => {
          setShelfLoading(false)
          setShelfError(error instanceof Error ? error.message : String(error))
        })
    },
    [commitStore, host],
  )

  const openWorkspace = useCallback(
    (target: Exclude<WorkspaceScreen, 'chat'>) => {
      setScreen(target)
      setFocus('composer')
      if (target === 'wallet') openWallet()
    },
    [openWallet],
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

  useEffect(() => {
    if (screen === 'assets' || screen === 'apps' || screen === 'txns') {
      loadShelf(screen, activeSender)
    }
  }, [activeSender, loadShelf, screen])

  const agentConfig = useMemo(() => loadAgentConfig(process.env), [])

  const runAgent = useCallback(
    (sectionId: number, input: string) => {
      if (!agentConfig) {
        appendNote(
          sectionId,
          'No agent configured — set VIBEKIT_AGENT_MODEL (e.g. qwen3:32b) and restart to chat.',
          'error',
        )
        return
      }
      if (agentBusy) {
        appendNote(sectionId, 'Still working on the last request.', 'error')
        return
      }
      setAgentBusy(true)
      setStatus('')
      agentSectionRef.current = sectionId
      agentHasCardsRef.current = false
      patchSection(sectionId, { thinking: '', thinkingOpen: false })
      const agentNoteItem = { current: null as number | null }
      const appendAgentText = (delta: string) => {
        if (agentNoteItem.current === null) {
          const id = newItemId()
          agentNoteItem.current = id
          appendItem(sectionId, { id, kind: 'note', text: delta, tone: 'agent' })
          return
        }
        const target = agentNoteItem.current
        commitSections(
          sectionsRef.current.map((section) =>
            section.id === sectionId
              ? {
                  ...section,
                  items: section.items.map((item) =>
                    item.id === target && item.kind === 'note'
                      ? { ...item, text: item.text + delta }
                      : item,
                  ),
                }
              : section,
          ),
        )
      }
      void (async () => {
        if (!agentRef.current) {
          const addressBook = signerReady
            ? await keystoreHost.listSigningAccounts().catch(() => [...FIXTURE_ADDRESS_BOOK])
            : [...FIXTURE_ADDRESS_BOOK]
          agentRef.current = createExplorerAgent({
            model: agentConfig,
            addressBook,
            network: networkRef.current,
          })
        }
        await runAgentTurn(agentRef.current, input, {
          onText: appendAgentText,
          onReasoning: (delta) => {
            const section = sectionsRef.current.find((entry) => entry.id === sectionId)
            const current = section?.thinking ?? ''
            if (current.length >= 64_000) return
            const next = current + delta
            patchSection(sectionId, {
              thinking: next.length > 64_000 ? next.slice(0, 64_000) : next,
            })
          },
          onToolCall: (toolName) => setStatus(`agent → ${toolName}…`),
          onToolResult: (event) => {
            agentNoteItem.current = null
            const compose = paymentComposeFromToolResult(event)
            if (compose && flowRef.current === null) {
              const draftRecord = draftRecordFromComposeWire(
                {
                  resultId: newId('result-agent-payment-draft'),
                  toolCallId: event.id,
                  network: networkRef.current,
                },
                compose,
              )
              setFlowMode('live')
              agentHasCardsRef.current = true
              void startPaymentFlowFromDraftRecord({
                host: keystoreHost,
                store: storeRef.current,
                draftRecord,
                newId,
                onStep: trackFlowStep(sectionId),
              }).then((run) => {
                commitStore(run.store)
                if (!run.ok)
                  finishPayment(run.flow, `The agent's payment failed — ${run.message}`, 'error')
                else if (run.flow) updateFlowBlock(run.flow)
              })
              return
            }
            try {
              // The tool's declared view cue selects the trusted view.
              const { record, view } = bridgeToolResult(event, {
                resultId: newId('result-agent'),
                toolCallId: event.id,
                network: networkRef.current,
              })
              commitStore(addResult(storeRef.current, record))
              agentHasCardsRef.current = true
              if (view === undefined) {
                const text =
                  record.state === 'success'
                    ? JSON.stringify(record.data, null, 2)
                    : JSON.stringify(record.error, null, 2)
                appendBlock(sectionId, {
                  id: 0,
                  kind: 'raw',
                  title: event.toolName,
                  text,
                })
                return
              }
              appendBlock(sectionId, {
                id: 0,
                kind: 'view',
                view: viewFor(record, view),
              })
            } catch {
              // A duplicate or malformed record is dropped; the narration still answers.
            }
          },
          onError: (message) =>
            appendNote(sectionId, `Agent error — ${shorten(message, 120)}`, 'error'),
        }).catch((error: unknown) => {
          appendNote(
            sectionId,
            `Agent failed — ${error instanceof Error ? shorten(error.message, 120) : 'unknown error'}`,
            'error',
          )
        })
        setAgentBusy(false)
        setStatus('')
        agentSectionRef.current = null
      })()
    },
    [
      agentBusy,
      agentConfig,
      appendBlock,
      appendItem,
      appendNote,
      commitSections,
      commitStore,
      finishPayment,
      keystoreHost,
      newId,
      newItemId,
      patchSection,
      signerReady,
      trackFlowStep,
      updateFlowBlock,
    ],
  )

  const submit = useCallback(
    (raw: string) => {
      setInput('')
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
          startPayment(sectionId, outcome.amountMicroAlgos)
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
        case 'sample':
          openTransaction(
            sectionId,
            live === true ? PAYMENT_FIXTURE_TRANSACTION_ID : FIXTURE_TRANSACTION_ID,
          )
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
      live,
      openAccount,
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

  const modalOpen = flow?.stage === 'awaiting-approval' && !busy

  const moveSelection = useCallback(
    (delta: number) => {
      const list = sectionsRef.current
      if (list.length === 0) return
      const current = list.findIndex((section) => section.id === selectedRef.current)
      const index =
        current < 0 ? list.length - 1 : Math.min(list.length - 1, Math.max(0, current + delta))
      selectSection(list[index]!.id)
    },
    [selectSection],
  )

  const closeSelectedSection = useCallback(() => {
    const list = sectionsRef.current
    const index = list.findIndex((section) => section.id === selectedRef.current)
    if (index < 0) return
    if (flowRef.current !== null && flowSectionRef.current === list[index]!.id) {
      setStatus('Finish or deny the payment before closing its section.')
      return
    }
    const next = list.filter((section) => section.id !== selectedRef.current)
    commitSections(next)
    if (next.length === 0) {
      setSelectedId(null)
      selectedRef.current = null
      setFocus('composer')
    } else {
      selectSection(next[Math.min(index, next.length - 1)]!.id)
    }
  }, [commitSections, selectSection])

  const cycleSort = useCallback(() => {
    commitSections(
      sectionsRef.current.map((section) =>
        section.id === selectedRef.current
          ? { ...section, sort: nextAssetSort(section.sort) }
          : section,
      ),
    )
  }, [commitSections])

  const width = dimensions.width
  const height = dimensions.height
  const isNarrow = width < 96

  useKeyboard(
    useCallback(
      (key) => {
        if (key.eventType === 'release') return
        if (modalOpen) {
          if (key.name === 'return' || key.name === 'enter') decide('approve')
          if (key.name === 'escape') decide('deny')
          return
        }
        if (key.ctrl && key.name === 'n') {
          switchNetwork()
          return
        }
        if (key.ctrl && key.name === 'w') {
          openWorkspace('wallet')
          return
        }
        if (key.ctrl && key.name === '1') {
          openWorkspace('assets')
          return
        }
        if (key.ctrl && key.name === '2') {
          openWorkspace('apps')
          return
        }
        if (key.ctrl && key.name === '3') {
          openWorkspace('txns')
          return
        }
        if (screen !== 'chat') {
          if (key.name === 'escape') {
            setScreen('chat')
            setFocus('composer')
            return
          }
          if (key.name === '[' || key.name === 'left') {
            cycleAccount(-1)
            return
          }
          if (key.name === ']' || key.name === 'right') {
            cycleAccount(1)
            return
          }
          if (screen === 'wallet') {
            const index = Number.parseInt(key.name, 10)
            if (Number.isInteger(index) && accountList[index - 1]) {
              setActiveSender(accountList[index - 1]!.address)
            }
          }
          return
        }
        if (focus === 'nav') {
          switch (key.name) {
            case 'escape':
            case 'c':
              setFocus('composer')
              return
            case 'tab':
              setFocus('content')
              return
            case 'up':
            case 'k':
              moveSelection(-1)
              return
            case 'down':
            case 'j':
              moveSelection(1)
              return
            case 'return':
            case 'enter':
              if (selectedRef.current !== null) scrollToSection(selectedRef.current)
              return
            case 's':
              cycleSort()
              return
            case 'x':
              closeSelectedSection()
              return
            default:
              return
          }
        }
        if (focus === 'content') {
          switch (key.name) {
            case 'tab':
            case 'escape':
            case 'c':
              setFocus('composer')
              return
            case 'up':
            case 'k':
              contentScrollRef.current?.scrollBy(-2)
              return
            case 'down':
            case 'j':
              contentScrollRef.current?.scrollBy(2)
              return
            case 'pageup':
              contentScrollRef.current?.scrollBy(-10)
              return
            case 'pagedown':
              contentScrollRef.current?.scrollBy(10)
              return
            case 'left':
            case '[':
              moveSelection(-1)
              return
            case 'right':
            case ']':
              moveSelection(1)
              return
            case 's':
              cycleSort()
              return
            case 'x':
              closeSelectedSection()
              return
            default:
              return
          }
        }
        if (key.name === 'tab' && sectionsRef.current.length > 0) {
          setFocus(isNarrow ? 'content' : 'nav')
        }
      },
      [
        accountList,
        closeSelectedSection,
        cycleAccount,
        cycleSort,
        decide,
        focus,
        isNarrow,
        modalOpen,
        moveSelection,
        openWorkspace,
        screen,
        scrollToSection,
        switchNetwork,
      ],
    ),
  )

  const navWidth = Math.min(34, Math.max(24, Math.floor(width * 0.24)))
  const modeLabel = live === 'probing' ? 'probing…' : live ? 'live' : 'sample data'
  const senderAccount = accountList.find((account) => account.address === activeSender)
  const composerFocused = screen === 'chat' && !modalOpen && focus === 'composer'
  const showNav = !isNarrow && screen === 'chat'
  const hint =
    agentBusy || busy
      ? 'working…'
      : agentConfig
        ? 'Ask anything, or: ^w wallet · ^1 assets · pay 0.5 · paste an ID'
        : '^w wallet · ^1 assets · pay 0.5 · paste an ID'

  const keybar = modalOpen
    ? 'enter approve · esc deny'
    : screen === 'wallet'
      ? '1-9 active account · esc chat · ^1 assets · ^2 apps · ^3 txns'
      : screen === 'assets' || screen === 'apps' || screen === 'txns'
        ? 'esc chat · ^w wallet · [ ] cycle account · ^1 assets · ^2 apps · ^3 txns'
        : focus === 'nav'
        ? '↑/↓ select · enter view · s sort · x close · tab content · esc chat'
        : focus === 'content'
          ? '↑/↓ scroll · ←/→ sections · s sort · x close · tab/esc chat'
          : sections.length > 0
            ? `enter send · tab session (${sections.length}) · ^w wallet · ^n network · ctrl+c quit`
            : 'enter send · drag copies · ^w wallet · ^1 assets · ^n network'

  const modalModel = useMemo(() => {
    if (!modalOpen || !flow) return undefined
    const derived = createPaymentFlowViewModel(store, flow)
    return derived.ok ? derived.model : undefined
  }, [flow, modalOpen, store])

  return (
    <CopyContext.Provider value={copyIdent}>
    <box flexDirection="column" width="100%" height="100%" backgroundColor={COLORS.background}>
      <TopBar
        screen={screen}
        modeLabel={modeLabel}
        network={network}
        accountName={senderAccount?.name}
        address={activeSender}
        width={width}
        onOpenWallet={() => openWorkspace('wallet')}
        onOpenScreen={openWorkspace}
        onSwitchNetwork={() => switchNetwork()}
      />
      {screen === 'wallet' ? (
        <WalletScreen
          accounts={accountList}
          loading={accountsLoading}
          signerReady={signerReady}
          activeSender={activeSender}
          width={width}
          onSelect={setActiveSender}
        />
      ) : screen === 'assets' || screen === 'apps' || screen === 'txns' ? (
        <ShelfScreen
          title={screen === 'assets' ? 'ASSETS' : screen === 'apps' ? 'APPS' : 'TRANSACTIONS'}
          accountName={senderAccount?.name}
          address={activeSender}
          loading={shelfLoading}
          error={shelfError}
          empty={
            screen === 'assets'
              ? 'No assets on this account.'
              : screen === 'apps'
                ? 'Not opted into any applications.'
                : 'No transactions yet.'
          }
          store={store}
          view={shelfView}
          width={width}
        />
      ) : (
        <box flexGrow={1} flexDirection="row">
          {showNav ? (
            <NavPane
              sections={sections}
              selectedId={selectedId}
              focused={focus === 'nav'}
              width={navWidth}
              onSelect={selectSection}
            />
          ) : null}
          <ContentPane
            sections={sections}
            selectedId={selectedId}
            store={store}
            focused={focus === 'content'}
            navFocused={focus === 'nav'}
            busyPayment={busy && flow !== null}
            liveThinkingSectionId={agentBusy ? agentSectionRef.current : null}
            hasAgent={Boolean(agentConfig)}
            width={showNav ? width - navWidth : width}
            scrollRef={contentScrollRef}
            sectionRegistry={sectionRegistry}
            onSelect={markSection}
            onToggleThinking={toggleThinking}
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
          onChange={setInput}
          onSubmit={submit}
        />
      ) : null}
      <box height={1} paddingX={1} backgroundColor={COLORS.panelRaised}>
        <text fg={COLORS.muted} content={shorten(keybar, width - 2)} />
      </box>
      {modalOpen ? (
        <ApprovalModal model={modalModel} screenWidth={width} screenHeight={height} />
      ) : null}
    </box>
    </CopyContext.Provider>
  )
}
