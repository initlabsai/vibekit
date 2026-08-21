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
  ZEROSIGNAL_SETUP_HINT,
  type AgentSession,
} from '@initlabs/vibekit-agent'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { enrichResultWithAbi } from '../abi-catalog.js'
import { createExplorerAgent, runAgentTurn } from '../agent-lane.js'
import type { AnyTool } from '@initlabs/vibekit-core'
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
  signerReady,
  commitStore,
  storeRef,
  newId,
  agentBusy,
  setAgentBusy,
  setStatus,
  extraTools,
  specCatalog,
}: {
  feed: Feed
  payment: PaymentLane
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
            .catch(() => appendNote(sectionId, ZEROSIGNAL_SETUP_HINT, 'error'))
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
          if (agentConfig.provider === 'zerosignal' && !(await probeZeroSignal(agentConfig.baseUrl))) {
            appendNote(sectionId, ZEROSIGNAL_SETUP_HINT, 'error')
            setAgentBusy(false)
            return
          }
          const addressBook = signerReady
            ? await keystoreHost.listSigningAccounts().catch(() => [...FIXTURE_ADDRESS_BOOK])
            : [...FIXTURE_ADDRESS_BOOK]
          addressBookRef.current = addressBook
          agentRef.current = createExplorerAgent({
            model: agentConfig,
            addressBook,
            network: networkRef.current,
            extraTools,
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
            const compose = unsignedGroupFromToolResult(event)
            if (compose && flowRef.current === null) {
              const draftRecord = draftRecordFromComposeWire(
                {
                  resultId: newId('result-agent-payment-draft'),
                  toolCallId: event.id,
                  network: networkRef.current,
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
                network: networkRef.current,
              })
              const enriched = withAccountNames(
                enrichResultWithAbi(record, specCatalog),
                addressBookRef.current,
              )
              commitStore(addResult(storeRef.current, enriched))
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
