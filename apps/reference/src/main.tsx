/**
 * The reference page: a prompt, the agent's words, its tool results as the
 * components render them, and the approval an action needs. No wallet is
 * wired, so an approved action rests at `approved` — the honest stop — and
 * says so. Add one with createWalletSignDraft to go all the way.
 */
import { createRemoteActionHost, draftDataSchema, resolveResultReference, type ResultStore, type StructuredResult } from '@initlabs/vibekit/actions'
import type { AgentEvent } from '@initlabs/vibekit/agent'
import { useCallback, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { Account } from './components/account'
import { useAction, type ActionNotice } from './components/action'
import { ActionApproval } from './components/action-approval'
import { Asset, AssetList } from './components/asset'
import { Companion } from './components/companion'
import { ToolResult } from './components/tool-result'
import { Transaction } from './components/transaction'
import './components/companion.css'
import './components/components.css'
import './main.css'

const NETWORK = 'testnet'
const FACES = {
  calm: ['(^‿^)', '(・‿・)', '(´▽`)'],
  thinking: ['(・・?)', '(￣ω￣;)'],
  working: ["(>'-')>", "<('-'<)", "^('-')^", "v('-')v"],
  bright: ['\\(^▽^)/', '(★‿★)'],
  squint: ['(¬_¬)', '(x_x)'],
}
type Result = Extract<AgentEvent, { type: 'tool-result' }>
type Line = { role: 'you' | 'agent'; text: string } | { role: 'result'; result: Result } | { role: 'note'; text: string }

/** A tool result as the component its view id names; anything else as JSON. */
function Card({ result }: { result: Result }) {
  const data = result.output as never
  if (result.isError) return <ToolResult {...result} />
  switch (result.view) {
    case 'transaction.detail':
      return <Transaction transaction={data} />
    case 'asset.detail':
      return <Asset asset={data} />
    case 'asset.list':
      return <AssetList assets={(data as { assets: never[] }).assets} />
    case 'account.summary':
      return <Account account={data} />
    default:
      return <ToolResult {...result} />
  }
}

function App() {
  const [lines, setLines] = useState<Line[]>([])
  const [history, setHistory] = useState<unknown[]>([])
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState('')
  const [steps, setSteps] = useState(0)
  const store = useRef<ResultStore>([])
  const [pendingDraft, setPendingDraft] = useState<{ draft: StructuredResult; simulation?: StructuredResult } | undefined>()
  const host = useMemo(() => createRemoteActionHost({ url: '/api/actions', network: NETWORK }), [])
  const note = (text: string) => setLines((current) => [...current, { role: 'note', text }])

  const onNotice = useCallback((notice: ActionNotice) => {
    store.current = notice.store
    if (notice.kind === 'step') {
      if (notice.flow.stage === 'awaiting-approval') {
        const draft = resolveResultReference(notice.store, notice.flow.draft)
        const simulation = notice.flow.simulation && resolveResultReference(notice.store, notice.flow.simulation)
        if (draft.ok) setPendingDraft({ draft: draft.record, ...(simulation?.ok ? { simulation: simulation.record } : {}) })
      }
      return
    }
    setPendingDraft(undefined)
    if (notice.kind === 'paused') note('approved — nothing was signed: this page has no wallet. Wire createWalletSignDraft to go on-chain.')
    else if (notice.kind === 'denied') note('denied — nothing was signed.')
    else if (notice.kind === 'confirmed') note(`confirmed in round ${notice.confirmation?.confirmedRound ?? '?'}`)
    else if (notice.kind === 'failed') note(`${notice.while} failed — ${notice.message}`)
  }, [])
  const action = useAction({ host: () => host, store, newId: (prefix) => `${prefix}-${crypto.randomUUID()}`, onNotice })

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setBusy(true)
    setLines((current) => [...current, { role: 'you', text }, { role: 'agent', text: '' }])
    const response = await fetch('/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ network: NETWORK, input: text, history }) })
    if (!response.ok || !response.body) {
      note(`the agent said no (${response.status}): ${((await response.json().catch(() => ({}))) as { error?: string }).error ?? ''}`)
      setBusy(false)
      return
    }
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
    let buffered = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffered += value
      const parts = buffered.split('\n')
      buffered = parts.pop() ?? ''
      for (const part of parts.filter(Boolean)) {
        const event = JSON.parse(part) as AgentEvent | { type: 'draft'; record: StructuredResult } | { type: 'messages'; messages: unknown[] } | { type: 'credits' }
        if (event.type === 'text-delta') setLines((current) => current.map((line, i) => (i === current.length - 1 && line.role === 'agent' ? { ...line, text: line.text + event.text } : line)))
        else if (event.type === 'tool-call') setSteps((n) => n + 1)
        else if (event.type === 'tool-result') setLines((current) => [...current, { role: 'result', result: event }, { role: 'agent', text: '' }])
        else if (event.type === 'draft') action.startFromDraft(event.record)
        else if (event.type === 'messages') setHistory((current) => [...current, ...event.messages])
        else if (event.type === 'error') note(event.message)
      }
    }
    setBusy(false)
  }

  const draftData = pendingDraft && pendingDraft.draft.state === 'success' ? draftDataSchema.parse(pendingDraft.draft.data) : undefined
  return (
    <main>
      <header>
        <Companion mood={busy ? 'working' : pendingDraft ? 'squint' : 'calm'} step={steps} faces={FACES} blink="(-‿-)" />
        <span>vibekit reference agent · {NETWORK}</span>
      </header>
      <section className="feed">
        {lines.map((line, i) =>
          line.role === 'result' ? (
            <Card key={i} result={line.result} />
          ) : line.text ? (
            <p key={i} className={line.role}>{line.text}</p>
          ) : null,
        )}
        {draftData && pendingDraft ? (
          <ActionApproval
            draft={draftData}
            simulation={pendingDraft.simulation?.state === 'success' ? (pendingDraft.simulation.data as never) : undefined}
            network={NETWORK}
            busy={action.phase !== 'idle'}
            onApprove={() => action.decide('approve')}
            onDeny={() => action.decide('deny')}
          />
        ) : null}
      </section>
      <form onSubmit={(e) => (e.preventDefault(), void send())}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="what is asset 10458941? · pay 0.1 ALGO to …" disabled={busy} autoFocus />
        <button type="submit" disabled={busy || !input.trim()}>ask</button>
      </form>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
