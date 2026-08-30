import { addResult, type ResultStore } from '@initlabs/vibekit/actions'
import type { LiveNetworkId } from '@initlabs/vibekit/views'
import { listZeroSignalModels, probeZeroSignal, zeroSignalSetupHint } from '@initlabs/vibekit/agent/providers'
import { resolveAgentConfig } from '@initlabs/vibekit/agent/config'
import { type AgentSession } from '@initlabs/vibekit/agent'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { labelProgramMethods } from '../apps/abi-catalog.js'
import {
  activeSenderLine,
  applyToolResultPlan,
  createExplorerAgent,
  explorerContext,
  planToolResult,
  programReadApproval,
  runAgentTurn,
} from './session.js'
import type { AnyTool } from '@initlabs/vibekit'
import type { NormalizedAppSpec } from '@initlabs/vibekit/tools'
import { shorten } from '../../theme.js'
import type { Feed } from '../../feed/hooks.js'
import type { Action } from '../action/hooks.js'

/**
 * Owns the agent lane: session lifecycle, streaming text/reasoning accretion
 * into the feed, and handing tool results to the feed, the store, or the
 * action flow. The session is rebuilt when the network, the extra tools, or
 * the plugin set change.
 */
export function useAgentLane({
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
  extraTools,
  specCatalog,
  specHashCatalog,
  disabledPlugins,
  onNetworkUsed,
  askConfirm,
}: {
  feed: Feed
  payment: Action
  network: LiveNetworkId
  networkRef: { current: LiveNetworkId }
  activeSender: string | undefined
  /** The keystore address book, or the sample one when no daemon answers. */
  accountList: ReadonlyArray<{ address: string; name?: string }>
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
  const addressBookRef = useRef(accountList)
  addressBookRef.current = accountList
  const agentRef = useRef<AgentSession | null>(null)
  /** Programs the user already agreed to pay for; further pages don't ask again. */
  const approvedProgramsRef = useRef(new Set<string>())
  /** The session's default network, fixed at creation. */
  const sessionNetworkRef = useRef<LiveNetworkId>(networkRef.current)

  const agentConfig = useMemo(() => resolveAgentConfig(process.env), [])
  const extraToolNames = extraTools.map((tool) => tool.name).join(',')
  const disabledPluginNames = [...disabledPlugins].sort().join(',')

  // The session is built for one network, tool set, and plugin set; when any
  // of them changes the next turn builds a fresh one.
  useEffect(() => {
    agentRef.current = null
  }, [network, extraToolNames, disabledPluginNames])

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
          sessionNetworkRef.current = networkRef.current
          agentRef.current = createExplorerAgent({
            model: agentConfig,
            addressBook: addressBookRef.current,
            network: networkRef.current,
            extraTools,
            disabledPlugins,
            labelProgram: (program) => labelProgramMethods(program, specCatalog, specHashCatalog),
            approveToolCall: programReadApproval({
              sessionNetwork: () => sessionNetworkRef.current,
              agentConfig,
              askConfirm,
              approved: approvedProgramsRef.current,
            }),
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
            applyToolResultPlan(plan, {
              addRecord: (record) => commitStore(addResult(storeRef.current, record)),
              appendBlock: (block) => appendBlock(sectionId, block),
              appendNote: (text, tone) => appendNote(sectionId, text, tone),
              startFromDraft: (draftRecord) =>
                startFromDraft(sectionId, draftRecord, 'agent', "The agent's write failed"),
            })
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
      askConfirm,
      disabledPlugins,
      extraTools,
      specCatalog,
      specHashCatalog,
      appendBlock,
      appendItem,
      appendNote,
      commitStore,
      flowRef,
      networkRef,
      newId,
      newItemId,
      onNetworkUsed,
      patchSection,
      sectionsRef,
      setAgentBusy,
      setStatus,
      startFromDraft,
      storeRef,
      updateItem,
    ],
  )

  return { agentConfig, runAgent, agentSectionRef }
}
