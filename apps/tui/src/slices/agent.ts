import {
  addResult,
  bridgeToolResult,
  FIXTURE_ADDRESS_BOOK,
  unsignedGroupFromToolResult,
  startPaymentFlowFromDraftRecord,
  type ResultStore,
} from '@initlabs/vibekit-experience'
import { draftRecordFromComposeWire, type LiveNetworkId } from '@initlabs/vibekit-experience/live'
import {
  listZeroSignalModels,
  probeZeroSignal,
  resolveAgentConfig,
  zeroSignalSetupHint,
  type AgentSession,
} from '@initlabs/vibekit-agent'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { enrichResultWithAbi } from '../abi-catalog.js'
import {
  activeSenderLine,
  createExplorerAgent,
  explorerContext,
  networkOfCall,
  programCostLines,
  runAgentTurn,
} from '../agent-lane.js'
import type { AnyTool } from '@initlabs/vibekit-core'
import type { NfdRecord } from '@initlabs/vibekit-plugin-nfd'
import type { NormalizedAppSpec } from '@initlabs/vibekit-tools'
import { withAccountNames, type KeystorePaymentHost } from '../keystore-host.js'
import { shorten } from '../theme.js'
import type { Feed } from './feed.js'
import { viewFor } from './lookup.js'
import type { PaymentLane } from './payment.js'

/**
 * Owns the agent lane: session lifecycle, streaming text/reasoning accretion
 * into the feed, and bridging tool results into trusted views or payments.
 */
export function useAgentLane({
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
  extraTools,
  specCatalog,
  onNetworkUsed,
  askConfirm,
}: {
  feed: Feed
  payment: PaymentLane
  activeSender: string | undefined
  keystoreHost: KeystorePaymentHost
  networkRef: { current: LiveNetworkId }
  signerReady: boolean
  commitStore: (next: ResultStore) => void
  storeRef: { current: ResultStore }
  newId: (prefix: string) => string
  agentBusy: boolean
  setAgentBusy: (busy: boolean) => void
  setStatus: (status: string) => void
  extraTools: readonly AnyTool[]
  specCatalog: ReadonlyMap<number, NormalizedAppSpec>
  /** The agent queried a network other than the active one. */
  onNetworkUsed: (network: LiveNetworkId, sectionId: number) => void
  /** Modal yes/no before an expensive tool call runs. */
  askConfirm: (title: string, lines: string[]) => Promise<boolean>
}) {
  const {
    appendBlock,
    appendItem,
    appendNote,
    commitSections,
    newItemId,
    patchSection,
    sectionsRef,
  } = feed
  const { flowRef, setFlowMode, trackFlowStep, updateFlowBlock, finishPayment } = payment

  const agentSectionRef = useRef<number | null>(null)
  const addressBookRef = useRef<ReadonlyArray<{ address: string; name?: string }>>([])
  const agentHasCardsRef = useRef(false)
  const agentRef = useRef<AgentSession | null>(null)
  /** Programs the user already agreed to pay for; further pages don't ask again. */
  const approvedProgramsRef = useRef(new Set<string>())
  /** The session's default network, fixed at creation. */
  const sessionNetworkRef = useRef<LiveNetworkId>(networkRef.current)

  const agentConfig = useMemo(() => resolveAgentConfig(process.env), [])
  const extraToolNames = extraTools.map((tool) => tool.name).join(',')

  /** Drops the live session, e.g. when the network changes under it. */
  const reset = useCallback(() => {
    agentRef.current = null
  }, [])

  // Spec scan / deployed associations can land after the first turn.
  useEffect(() => {
    agentRef.current = null
  }, [extraToolNames])

  const runAgent = useCallback(
    (sectionId: number, input: string) => {
      if (!agentConfig) {
        if (process.env.VIBEKIT_AGENT_PROVIDER === 'zerosignal') {
          // ZeroSignal has no default model; offer the live catalog.
          void listZeroSignalModels()
            .then((models) =>
              appendNote(
                sectionId,
                `Set VIBEKIT_AGENT_MODEL to a ZeroSignal model and restart. Available: ${models.slice(0, 8).join(', ')}${models.length > 8 ? ', …' : ''}`,
                'error',
              ),
            )
            .catch(() => appendNote(sectionId, zeroSignalSetupHint(), 'error'))
          return
        }
        appendNote(
          sectionId,
          'No agent configured — run `vibekit explore setup` (or set VIBEKIT_AGENT_MODEL) and restart to chat.',
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
      let spoke = false
      const appendAgentText = (delta: string) => {
        spoke = true
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
          if (agentConfig.provider === 'zerosignal' && !(await probeZeroSignal(agentConfig.baseUrl))) {
            appendNote(sectionId, zeroSignalSetupHint(agentConfig.baseUrl), 'error')
            setAgentBusy(false)
            return
          }
          const addressBook = signerReady
            ? await keystoreHost.listSigningAccounts().catch(() => [...FIXTURE_ADDRESS_BOOK])
            : [...FIXTURE_ADDRESS_BOOK]
          addressBookRef.current = addressBook
          sessionNetworkRef.current = networkRef.current
          agentRef.current = createExplorerAgent({
            model: agentConfig,
            addressBook,
            network: networkRef.current,
            extraTools,
            approveToolCall: async ({ toolName, input }) => {
              if (toolName !== 'get_application_program') return true
              const { applicationId, network } = (input ?? {}) as { applicationId?: number; network?: string }
              const target = networkOfCall({ network }, sessionNetworkRef.current)
              const key = `${target}:${applicationId}`
              if (approvedProgramsRef.current.has(key)) return true
              const lines = await programCostLines(applicationId, target, agentConfig)
              const approved = await askConfirm('ANALYZE THIS CONTRACT?', lines)
              if (approved) approvedProgramsRef.current.add(key)
              return approved
            },
          })
        }
        const context = [
          activeSenderLine(activeSender, addressBookRef.current),
          explorerContext(storeRef.current),
        ]
          .filter(Boolean)
          .join('\n')
        await runAgentTurn(agentRef.current, context ? `${context}\n\n${input}` : input, {
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
            spoke = true
            agentNoteItem.current = null
            const usedNetwork = networkOfCall(event.input, sessionNetworkRef.current)
            if (usedNetwork !== networkRef.current) onNetworkUsed(usedNetwork, sectionId)
            const compose = unsignedGroupFromToolResult(event)
            if (compose && flowRef.current === null) {
              const draftRecord = draftRecordFromComposeWire(
                {
                  resultId: newId('result-agent-payment-draft'),
                  toolCallId: event.id,
                  network: usedNetwork,
                },
                compose,
                event.toolName,
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
                network: usedNetwork,
              })
              const enriched = withAccountNames(
                enrichResultWithAbi(record, specCatalog),
                addressBookRef.current,
              )
              commitStore(addResult(storeRef.current, enriched))
              agentHasCardsRef.current = true
              if (view === undefined && event.toolName === 'resolve_nfd' && record.state === 'success') {
                appendBlock(sectionId, {
                  id: 0,
                  kind: 'nfd',
                  data: record.data as unknown as NfdRecord,
                  network: usedNetwork,
                })
                return
              }
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
            } catch (error: unknown) {
              // Say so: a silently dropped result looks like the agent said nothing.
              appendNote(
                sectionId,
                `Dropped a malformed result from ${event.toolName} — ${error instanceof Error ? shorten(error.message, 100) : 'unknown error'}`,
                'error',
              )
            }
          },
          onError: (message) => {
            spoke = true
            appendNote(sectionId, `Agent error — ${shorten(message, 120)}`, 'error')
          },
        }).catch((error: unknown) => {
          spoke = true
          appendNote(
            sectionId,
            `Agent failed — ${error instanceof Error ? shorten(error.message, 120) : 'unknown error'}`,
            'error',
          )
        })
        if (!spoke) {
          appendNote(
            sectionId,
            'The agent returned nothing. Try a more specific ask — an id, a round, a name.',
            'error',
          )
        }
        setAgentBusy(false)
        setStatus('')
        agentSectionRef.current = null
      })()
    },
    [
      agentBusy,
      activeSender,
      agentConfig,
      extraTools,
      specCatalog,
      appendBlock,
      appendItem,
      appendNote,
      commitSections,
      commitStore,
      finishPayment,
      flowRef,
      keystoreHost,
      networkRef,
      newId,
      newItemId,
      patchSection,
      sectionsRef,
      setAgentBusy,
      setFlowMode,
      setStatus,
      signerReady,
      storeRef,
      trackFlowStep,
      updateFlowBlock,
    ],
  )

  return { agentConfig, runAgent, agentSectionRef, reset }
}
