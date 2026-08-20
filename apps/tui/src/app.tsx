import {
  addResult,
  createAccountPortfolioViewModel,
  createFixturePaymentHost,
  createFixtureResultStore,
  createPaymentFlowViewModel,
  createTransactionDetailViewModel,
  formatMicroAlgos,
  FIXTURE_ADDRESS_BOOK,
  FIXTURE_RECEIVER,
  FIXTURE_SENDER,
  FIXTURE_TRANSACTION_ID,
  PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  PAYMENT_FIXTURE_TRANSACTION_ID,
  bridgeToolResult,
  paymentComposeFromToolResult,
  performLivePaymentStep,
  startPaymentFlow,
  startPaymentFlowFromDraftRecord,
  completeApprovedPaymentFlow,
  EXPERIENCE_PROTOCOL_VERSION,
  type ResultStore,
  type StructuredResult,
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
import { routeComposerInput } from './commands.js'
import { createKeystorePaymentHost, type KeystorePaymentHost } from './keystore-host.js'
import {
  ContentPane,
  NavPane,
  type Section,
  type SectionBlock,
  type SectionItem,
} from './sections.js'
import { COLORS, shorten } from './theme.js'

const WELCOME = [
  'Ask anything about Algorand, or use a command:',
  '  accounts        your keystore accounts',
  '  pay 0.5         send a payment (you approve before anything is signed)',
  '  sample          open a sample transaction',
  '  network testnet whichever network to explore (ctrl+n cycles)',
  '  …or paste any transaction ID or address.',
  'Answers render here; the session pane on the left jumps between them.',
  'Set VIBEKIT_AGENT_MODEL to chat in natural language.',
  'help shows this again · ctrl+c quits',
].join('\n')

const NETWORKS: LiveNetworkId[] = ['localnet', 'testnet', 'mainnet']

const NETWORK_COLORS: Record<LiveNetworkId, string> = {
  localnet: COLORS.green,
  testnet: COLORS.brass,
  mainnet: COLORS.red,
}

type Focus = 'composer' | 'nav' | 'content'

function viewFor(
  record: StructuredResult,
  view: 'transaction.detail' | 'account.portfolio',
): ViewSpec {
  return {
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'view',
    view,
    source: { source: 'result', id: record.resultId },
  } as ViewSpec
}

function AccountsScreen({
  accounts,
  loading,
  signerReady,
  width,
}: {
  accounts: ReadonlyArray<{ address: string; name?: string }>
  loading: boolean
  signerReady: boolean
  width: number
}) {
  return (
    <box flexDirection="column" flexGrow={1} padding={1} backgroundColor={COLORS.panel}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={COLORS.brassBright}>ACCOUNTS</text>
        <text fg={COLORS.muted}>{signerReady ? 'keystore address book' : 'sample accounts'}</text>
      </box>
      <text
        fg={COLORS.text}
        marginTop={1}
        content={
          loading
            ? 'Loading accounts…'
            : accounts.length === 0
              ? 'No accounts found'
              : accounts
                  .map(
                    (account, index) =>
                      `[${index + 1}] ${(account.name ?? '—').padEnd(16)} ${shorten(account.address, width - 24)}`,
                  )
                  .join('\n')
        }
      />
      <text fg={COLORS.brass} marginTop={1} content="[1-9] open an account · [esc] back to chat" />
    </box>
  )
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
      borderStyle="single"
      borderColor={focused ? COLORS.brass : COLORS.border}
      backgroundColor={COLORS.panelRaised}
    >
      <text fg={focused ? COLORS.brassBright : COLORS.muted}>› </text>
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
 * The Explorer as index + pager: a session nav on the left (one line per
 * request, click or ↑/↓ to jump), and a reading pane on the right where each
 * request's narration, cards, and errors render together as a section. New
 * sections open at the top of the viewport. Tab cycles composer → nav →
 * content; a payment decision is a true modal over everything.
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
  const [store, setStore] = useState<ResultStore>(createFixtureResultStore)
  const [sections, setSections] = useState<Section[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [focus, setFocus] = useState<Focus>('composer')
  const [flow, setFlow] = useState<WriteFlowState | null>(null)
  const [flowMode, setFlowMode] = useState<'live' | 'sample'>('sample')
  const [busy, setBusy] = useState(false)
  const [agentBusy, setAgentBusy] = useState(false)
  const [screen, setScreen] = useState<'chat' | 'accounts'>('chat')
  const [accountList, setAccountList] = useState<ReadonlyArray<{ address: string; name?: string }>>(
    [],
  )
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [thinking, setThinking] = useState('')
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
    keystoreHost.canSign(FIXTURE_SENDER).then((ready) => {
      if (!cancelled) setSignerReady(ready)
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

  /** Aligns a section's header with the top of the reading pane. */
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

  const selectSection = useCallback(
    (id: number) => {
      setSelectedId(id)
      selectedRef.current = id
      scrollToSection(id)
    },
    [scrollToSection],
  )

  /** Creates the section for one user request and returns its id. */
  const createSection = useCallback(
    (prompt: string): number => {
      sectionSeq.current += 1
      const id = sectionSeq.current
      commitSections([...sectionsRef.current, { id, prompt, sort: 'none', items: [] }])
      setSelectedId(id)
      selectedRef.current = id
      // The renderable mounts a frame after the commit; align it then.
      setTimeout(() => scrollToSection(id), 50)
      return id
    },
    [commitSections, scrollToSection],
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
          sender: FIXTURE_SENDER,
          receiver: FIXTURE_RECEIVER,
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
          appendBlock(sectionId, { id: 0, kind: 'transaction', view })
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
          appendBlock(sectionId, { id: 0, kind: 'account', view })
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

  const openAccountsScreen = useCallback(() => {
    setScreen('accounts')
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
      setStatus('thinking…')
      agentSectionRef.current = sectionId
      agentHasCardsRef.current = false
      setThinking('')
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
          // The reasoning stream shows inside the section until its first
          // card renders; capped so a long thinker can't grow without bound.
          onReasoning: (delta) => {
            if (agentHasCardsRef.current) return
            setThinking((current) => (current + delta).slice(-4000))
          },
          onToolCall: (toolName) => setStatus(`agent → ${toolName}…`),
          onToolResult: (event) => {
            agentNoteItem.current = null
            setThinking('')
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
              // The tool's declared display hint selects the trusted view.
              const { record, view } = bridgeToolResult(event, {
                resultId: newId('result-agent'),
                toolCallId: event.id,
                network: networkRef.current,
              })
              commitStore(addResult(storeRef.current, record))
              if (view === undefined) return
              agentHasCardsRef.current = true
              appendBlock(sectionId, {
                id: 0,
                kind: view === 'transaction.detail' ? 'transaction' : 'account',
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
        setThinking('')
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
        openAccountsScreen()
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
        case 'account':
          openAccount(sectionId, outcome.address)
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
          appendNote(sectionId, WELCOME)
          return
        case 'ambiguous':
          appendNote(
            sectionId,
            `${outcome.value} could be an asset, app, or block — those views are coming soon.`,
          )
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
      openAccountsScreen,
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
        if (screen === 'accounts') {
          if (key.name === 'escape') {
            setScreen('chat')
            return
          }
          const index = Number.parseInt(key.name, 10)
          if (Number.isInteger(index) && accountList[index - 1]) {
            const account = accountList[index - 1]!
            const sectionId = createSection(
              `accounts → ${account.name ?? shorten(account.address, 12)}`,
            )
            openAccount(sectionId, account.address)
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
        createSection,
        cycleSort,
        decide,
        focus,
        isNarrow,
        modalOpen,
        moveSelection,
        openAccount,
        screen,
        scrollToSection,
        switchNetwork,
      ],
    ),
  )

  const navWidth = Math.min(34, Math.max(24, Math.floor(width * 0.24)))
  const modeLabel = live === 'probing' ? 'probing…' : live ? 'live' : 'sample data'
  const signerLabel = signerReady ? 'keystore' : 'none'
  const composerFocused = screen === 'chat' && !modalOpen && focus === 'composer'
  const showNav = !isNarrow
  const hint =
    agentBusy || busy
      ? 'working…'
      : agentConfig
        ? 'Ask anything, or: accounts · pay 0.5 · sample · paste an ID'
        : 'accounts · pay 0.5 · sample · paste an ID'

  const keybar = modalOpen
    ? 'enter approve · esc deny'
    : screen === 'accounts'
      ? '1-9 open account · esc back to chat'
      : focus === 'nav'
        ? '↑/↓ select · enter view · s sort · x close · tab content · esc chat'
        : focus === 'content'
          ? '↑/↓ scroll · ←/→ sections · s sort · x close · tab/esc chat'
          : sections.length > 0
            ? `enter send · tab session (${sections.length}) · ctrl+n network · ctrl+c quit`
            : 'enter send · ctrl+n network · ctrl+c quit'

  const modalModel = useMemo(() => {
    if (!modalOpen || !flow) return undefined
    const derived = createPaymentFlowViewModel(store, flow)
    return derived.ok ? derived.model : undefined
  }, [flow, modalOpen, store])

  return (
    <box flexDirection="column" width="100%" height="100%" backgroundColor={COLORS.background}>
      <box
        height={1}
        flexDirection="row"
        justifyContent="space-between"
        paddingX={1}
        backgroundColor={COLORS.panelRaised}
      >
        <box flexDirection="row">
          <text fg={COLORS.brassBright}>◆ VIBEKIT EXPLORER</text>
        </box>
        <box flexDirection="row">
          <text fg={COLORS.muted}>{`${modeLabel} · signer ${signerLabel} `}</text>
          <text fg={COLORS.background} bg={NETWORK_COLORS[network]}>
            {` ${network.toUpperCase()} `}
          </text>
          <text fg={COLORS.muted}> ‹ctrl+n›</text>
        </box>
      </box>
      {screen === 'accounts' ? (
        <AccountsScreen
          accounts={accountList}
          loading={accountsLoading}
          signerReady={signerReady}
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
            thinking={agentBusy ? thinking : undefined}
            thinkingSectionId={agentSectionRef.current}
            emptyText={WELCOME}
            width={showNav ? width - navWidth : width}
            scrollRef={contentScrollRef}
            sectionRegistry={sectionRegistry}
            onSelect={selectSection}
          />
        </box>
      )}
      {status !== '' ? (
        <text height={1} paddingX={1} fg={COLORS.muted} content={shorten(status, width - 4)} />
      ) : null}
      <Composer
        epoch={inputEpoch}
        focused={composerFocused}
        hint={hint}
        onChange={setInput}
        onSubmit={submit}
      />
      <box height={1} paddingX={1} backgroundColor={COLORS.panelRaised}>
        <text fg={COLORS.muted} content={shorten(keybar, width - 2)} />
      </box>
      {modalOpen ? (
        <ApprovalModal model={modalModel} screenWidth={width} screenHeight={height} />
      ) : null}
    </box>
  )
}
