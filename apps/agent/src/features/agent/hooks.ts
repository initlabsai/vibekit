/**
 * The agent lane in the browser: one POST per turn to /api/agent, its events
 * landing in the transcript as they stream — narration as an agent note,
 * tool results as the same cards the direct lane makes, a composed group as
 * the approval modal. The browser keeps the history and sends it back.
 */
import {
  addResult,
  bridgeToolResult,
  structuredResultSchema,
  type JsonValue,
  type LiveNetworkId,
  type ResultStore,
  type StructuredResult,
  type ToolResultEventLike,
} from '@initlabs/vibekit-explorer'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { WalletAccount } from '../../commands'
import type { Feed } from '../../feed/hooks'
import { viewFor } from '../../lookup'
import { nfdProfileSchema } from '../../remote-host'
import { shorten } from '../../theme'
import { creditsHeaders } from '../credits/hooks'
import { readEvents } from './stream'

/** A tool-result event as the route streams it: the AI SDK's shape plus the tool's view id. */
interface AgentToolResult {
  id: string
  toolName: string
  input?: unknown
  output: unknown
  view?: string
  isError: boolean
}

export interface AgentStatus {
  enabled: boolean
  model?: string
  provider?: string
  billing?: 'house' | 'x402'
}

const CONTEXT_KEYS = ['id', 'address', 'assetId', 'applicationId', 'round', 'groupId', 'network'] as const

/** What the Explorer is showing, so "that transaction" means something to the model. */
export function explorerContext(store: ResultStore, network: string, limit = 3): string {
  const lines = store
    .filter((record) => record.network === network && record.state === 'success')
    .slice(-limit)
    .map((record) => {
      const data = (record.state === 'success' ? record.data : {}) as Record<string, unknown>
      const facts = CONTEXT_KEYS.filter((key) => data?.[key] !== undefined).map((key) => `${key}=${String(data[key])}`)
      return `- ${record.toolName}: ${facts.join(' ')}`
    })
  return lines.length === 0 ? '' : `Cards on screen (oldest first):\n${lines.join('\n')}`
}

export function useAgentLane({
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
  startFromDraft,
  onCredits,
}: {
  feed: Feed
  storeRef: { current: ResultStore }
  commitStore: (next: ResultStore) => void
  networkRef: { current: LiveNetworkId }
  accounts: ReadonlyArray<WalletAccount>
  activeAddress: string | undefined
  live: 'probing' | boolean
  busyRef: { current: boolean }
  setBusy: (busy: boolean) => void
  setStatus: (text: string) => void
  startFromDraft: (sectionId: number, draftRecord: StructuredResult) => void
  /** The balance the route reports after charging a turn. */
  onCredits?: (credits: { paid?: number; freeLeft?: number }) => void
}) {
  const { appendBlock, appendNote, updateItem, removeItem } = feed
  const [status, setAgentStatus] = useState<AgentStatus>({ enabled: false })
  /** The model's view of the conversation; opaque here, sent back each turn. */
  const historyRef = useRef<unknown[]>([])
  const [streamingSection, setStreamingSection] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/agent')
      .then((response) => (response.ok ? response.json() : { enabled: false }))
      .then((payload: AgentStatus) => {
        if (!cancelled) setAgentStatus(payload)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  // A new network is a new conversation; the model's ids would point at the wrong chain.
  const historyNetwork = useRef(networkRef.current)

  const runAgent = useCallback(
    async (sectionId: number, input: string) => {
      if (!status.enabled) {
        appendNote(sectionId, 'No agent configured. Paste an id, or `pay 0.5 to <address>`.', 'error')
        return
      }
      if (busyRef.current) {
        appendNote(sectionId, 'Still working on the last request.', 'error')
        return
      }
      if (live !== true) {
        appendNote(sectionId, `The agent needs a live network — ${networkRef.current} is unreachable.`, 'error')
        return
      }
      const network = networkRef.current
      if (historyNetwork.current !== network) {
        historyRef.current = []
        historyNetwork.current = network
      }
      setBusy(true)
      setStreamingSection(sectionId)
      // She narrates her own progress in the transcript: a pending line becomes her sentence when she speaks.
      let noteId = feed.appendNoteReturning(sectionId, 'thinking…', 'agent')
      updateItem(sectionId, noteId, (item) => (item.kind === 'note' ? { ...item, pending: true } : item))
      let pending = true
      let spoke = false
      const setNote = (text: string, isPending: boolean) =>
        updateItem(sectionId, noteId, (item) => (item.kind === 'note' ? { ...item, text, pending: isPending } : item))
      const progress = (text: string) => {
        if (pending) setNote(text, true)
        else {
          noteId = feed.appendNoteReturning(sectionId, text, 'agent')
          updateItem(sectionId, noteId, (item) => (item.kind === 'note' ? { ...item, pending: true } : item))
          pending = true
        }
      }
      const say = (delta: string) => {
        spoke = true
        if (pending) {
          setNote(delta, false)
          pending = false
          return
        }
        updateItem(sectionId, noteId, (item) => (item.kind === 'note' ? { ...item, text: item.text + delta } : item))
      }
      try {
        const response = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...creditsHeaders() },
          body: JSON.stringify({
            network,
            input,
            accounts: accounts.map(({ address, name }) => ({ address, ...(name ? { name } : {}) })),
            ...(activeAddress ? { activeAddress } : {}),
            context: explorerContext(storeRef.current, network),
            history: historyRef.current,
          }),
        })
        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(payload.error ?? `agent route failed (${response.status})`)
        }
        for await (const raw of readEvents(response.body)) {
          const event = raw as { type: string } & Record<string, unknown>
          switch (event.type) {
            case 'text-delta':
              say(String(event.text))
              break
            case 'tool-call':
              progress(`→ ${String(event.toolName)}…`)
              break
            case 'tool-result': {
              spoke = true
              if (pending) removeItem(sectionId, noteId)
              landToolResult(sectionId, event as unknown as AgentToolResult, network)
              noteId = feed.appendNoteReturning(sectionId, 'thinking…', 'agent')
              updateItem(sectionId, noteId, (item) => (item.kind === 'note' ? { ...item, pending: true } : item))
              pending = true
              break
            }
            case 'draft': {
              spoke = true
              if (pending) removeItem(sectionId, noteId)
              const record = structuredResultSchema.parse(event.record)
              startFromDraft(sectionId, record)
              noteId = feed.appendNoteReturning(sectionId, 'thinking…', 'agent')
              updateItem(sectionId, noteId, (item) => (item.kind === 'note' ? { ...item, pending: true } : item))
              pending = true
              break
            }
            case 'messages':
              historyRef.current = event.messages as unknown[]
              break
            case 'credits':
              onCredits?.(event.credits as { paid?: number; freeLeft?: number })
              break
            case 'error':
              spoke = true
              appendNote(sectionId, `Agent error — ${shorten(String(event.message), 160)}`, 'error')
              break
            default:
              break
          }
        }
        if (pending) removeItem(sectionId, noteId)
        if (!spoke) appendNote(sectionId, 'The agent returned nothing. Try a more specific ask — an id, a round, a name.', 'error')
      } catch (error) {
        if (pending) removeItem(sectionId, noteId)
        appendNote(sectionId, `Agent failed — ${shorten(error instanceof Error ? error.message : String(error), 160)}`, 'error')
      } finally {
        setBusy(false)
        setStreamingSection(null)
        // The reply landed above the fold while it streamed; end on its last line.
        feed.scrollToBottom()
      }
    },
    [accounts, activeAddress, appendNote, busyRef, feed, live, networkRef, onCredits, removeItem, setBusy, startFromDraft, status.enabled, storeRef, updateItem],
  )

  /** A tool result becomes a record and a card, exactly as a direct-lane lookup would. */
  const landToolResult = useCallback(
    (sectionId: number, event: AgentToolResult, network: LiveNetworkId) => {
      // A tool that failed is one line, not a JSON block; she reads the same line and says why.
      if (event.isError) {
        const error = (event.output as { error?: { code?: string; message?: string } })?.error
        const declined = error?.code === 'DENIED'
        appendNote(sectionId, `${event.toolName} — ${declined ? 'declined by the house cap' : (error?.message ?? 'failed')}`, declined ? 'muted' : 'error')
        return
      }
      const { network: _network, ...input } =
        event.input !== null && typeof event.input === 'object' && !Array.isArray(event.input) ? (event.input as Record<string, unknown>) : {}
      try {
        const { record, view, degraded } = bridgeToolResult(event as ToolResultEventLike, {
          resultId: `result-agent-${crypto.randomUUID()}`,
          toolCallId: event.id,
          network,
          input: input as JsonValue,
        })
        commitStore(addResult(storeRef.current, record))
        if (view !== undefined) {
          appendBlock(sectionId, { kind: 'view', view: viewFor(record, view) })
        } else if (event.view === 'nfd.profile' && record.state === 'success') {
          const parsed = nfdProfileSchema.safeParse(record.data)
          if (parsed.success) appendBlock(sectionId, { kind: 'plugin', view: 'nfd.profile', data: parsed.data, network })
          else appendBlock(sectionId, { kind: 'raw', title: event.toolName, text: JSON.stringify(record.data, null, 2) })
        } else {
          const text = JSON.stringify(record.state === 'success' ? record.data : record.error, null, 2)
          appendBlock(sectionId, { kind: 'raw', title: event.toolName, text })
        }
        if (degraded) appendNote(sectionId, `${event.toolName} declared ${degraded.view} but its result didn't parse (${degraded.reason}) — shown raw.`, 'error')
      } catch (error) {
        appendNote(sectionId, `Dropped a malformed result from ${event.toolName} — ${shorten(error instanceof Error ? error.message : String(error), 100)}`, 'error')
      }
    },
    [appendBlock, appendNote, commitStore, storeRef],
  )

  return { status, runAgent, streamingSection }
}
