import { addResult, FIXTURE_ADDRESS_BOOK, type ResultStore } from '@initlabs/vibekit-explorer'
import type { LiveNetworkId } from '@initlabs/vibekit-explorer/live'
import {
  listZeroSignalModels,
  probeZeroSignal,
  resolveAgentConfig,
  zeroSignalSetupHint,
  type AgentSession,
} from '@initlabs/vibekit/agent'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { labelProgramMethods } from '../apps/abi-catalog.js'
import {
  activeSenderLine,
  createExplorerAgent,
  explorerContext,
  networkOfCall,
  planToolResult,
  programCostLines,
  runAgentTurn,
} from './session.js'
import type { AnyTool } from '@initlabs/vibekit'
import type { NormalizedAppSpec } from '@initlabs/vibekit/tools'
import type { KeystorePaymentHost } from '../network/keystore-host.js'
import { shorten } from '../../theme.js'
import type { Feed } from '../../feed/hooks.js'
import type { WriteFlow } from '../write-flow/hooks.js'

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
  specHashCatalog,
  disabledPlugins,
  onNetworkUsed,
  askConfirm,
}: {
  feed: Feed
  payment: WriteFlow
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
  /** Local specs by compiled-program hash: proves a spec is an app's without a deploy record. */
  specHashCatalog: ReadonlyMap<string, NormalizedAppSpec>
  /** Plugins the user turned off; the session rebuilds without their tools. */
  disabledPlugins: ReadonlySet<string>
  /** The agent queried a network other than the active one. */
  onNetworkUsed: (network: LiveNetworkId, sectionId: number) => void
  /** Modal yes/no before an expensive tool call runs. */
  askConfirm: (title: string, lines: string[]) => Promise<boolean>
}) {
  const { appendBlock, appendItem, appendNote, newItemId, patchSection, sectionsRef, updateItem } =
    feed
  const { flowRef, startFromDraft } = payment

  const agentSectionRef = useRef<number | null>(null)
  const addressBookRef = useRef<ReadonlyArray<{ address: string; name?: string }>>([])
  const agentRef = useRef<AgentSession | null>(null)
  /** Programs the user already agreed to pay for; further pages don't ask again. */
  const approvedProgramsRef = useRef(new Set<string>())
  /** The session's default network, fixed at creation. */
  const sessionNetworkRef = useRef<LiveNetworkId>(networkRef.current)

  const agentConfig = useMemo(() => resolveAgentConfig(process.env), [])
  const extraToolNames = extraTools.map((tool) => tool.name).join(',')
  const disabledPluginNames = [...disabledPlugins].sort().join(',')

  /** Drops the live session, e.g. when the network changes under it. */
  const reset = useCallback(() => {
    agentRef.current = null
  }, [])

  // Spec scan / deployed associations can land after the first turn; plugin
  // toggles drop the session the same way.
  useEffect(() => {
    agentRef.current = null
  }, [extraToolNames, disabledPluginNames])

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
      patchSection(sectionId, { thinking: '', thinkingOpen: false })
      const agentNoteItem = { current: null as number | null }
      let spoke = false
      // A tool result between two thoughts: the next thought starts a paragraph.
      let thoughtBreak = false
      const appendAgentText = (delta: string) => {
        spoke = true
        if (agentNoteItem.current === null) {
          const id = newItemId()
          agentNoteItem.current = id
          appendItem(sectionId, { id, kind: 'note', text: delta, tone: 'agent' })
          return
        }
        updateItem(sectionId, agentNoteItem.current, (item) =>
          item.kind === 'note' ? { ...item, text: item.text + delta } : item,
        )
      }
      void (async () => {
        if (!agentRef.current) {
          if (
            agentConfig.provider === 'zerosignal' &&
            !(await probeZeroSignal(agentConfig.baseUrl))
          ) {
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
            disabledPlugins,
            labelProgram: (program) => labelProgramMethods(program, specCatalog, specHashCatalog),
            approveToolCall: async ({ toolName, input }) => {
              if (toolName !== 'get_application_program') return true
              const { applicationId, network } = (input ?? {}) as {
                applicationId?: number
                network?: string
              }
              const target = networkOfCall({ network }, sessionNetworkRef.current)
              const key = `${target}:${applicationId}`
              if (approvedProgramsRef.current.has(key)) return true
              const lines = await programCostLines(applicationId, target, agentConfig)
              const approved = await askConfirm('EXPLAIN THIS CONTRACT?', lines)
              if (approved) approvedProgramsRef.current.add(key)
              return approved
            },
          })
        }
        const context = [
          activeSenderLine(activeSender, addressBookRef.current),
          explorerContext(storeRef.current, 3, networkRef.current),
        ]
          .filter(Boolean)
          .join('\n')
        await runAgentTurn(agentRef.current, context ? `${context}\n\n${input}` : input, {
          onText: appendAgentText,
          onReasoning: (delta) => {
            const section = sectionsRef.current.find((entry) => entry.id === sectionId)
            const current = section?.thinking ?? ''
            if (current.length >= 64_000) return
            const next = current + (thoughtBreak && current.length > 0 ? '\n\n' : '') + delta
            thoughtBreak = false
            patchSection(sectionId, {
              thinking: next.length > 64_000 ? next.slice(0, 64_000) : next,
            })
          },
          onToolCall: (toolName) => setStatus(`agent → ${toolName}…`),
          onToolResult: (event) => {
            spoke = true
            thoughtBreak = true
            agentNoteItem.current = null
            const plan = planToolResult(event, {
              sessionNetwork: sessionNetworkRef.current,
              paymentInFlight: flowRef.current !== null,
              newId,
              specCatalog,
              addressBook: addressBookRef.current,
            })
            if (plan.usedNetwork !== networkRef.current) onNetworkUsed(plan.usedNetwork, sectionId)
            switch (plan.kind) {
              case 'write':
                startFromDraft(sectionId, plan.draftRecord, 'agent', "The agent's write failed")
                return
              case 'cards':
                commitStore(addResult(storeRef.current, plan.record))
                for (const block of plan.blocks) appendBlock(sectionId, block)
                if (plan.note) appendNote(sectionId, plan.note, 'error')
                return
              case 'dropped':
                appendNote(sectionId, plan.message, 'error')
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
      disabledPlugins,
      extraTools,
      specCatalog,
      appendBlock,
      appendItem,
      appendNote,
      commitStore,
      flowRef,
      keystoreHost,
      networkRef,
      newId,
      newItemId,
      patchSection,
      sectionsRef,
      setAgentBusy,
      setStatus,
      signerReady,
      startFromDraft,
      storeRef,
      updateItem,
    ],
  )

  return { agentConfig, runAgent, agentSectionRef, reset }
}
