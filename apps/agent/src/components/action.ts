'use client'

/**
 * useAction: one action at a time, from draft to confirmed or denied. The
 * hook owns the open flow and the busy guard; everything the app wants to
 * show — the block in a feed, a note, a status line — comes out of `onNotice`.
 * `host` decides custody: with `signDraft` the approval signs and submits,
 * without it the action rests at `approved`. Copy this file; edit freely.
 */
import {
  performActionStep,
  startAction,
  startActionFromDraft,
  submitAction,
  type ActionDraft,
  type ActionHost,
  type ActionState,
  type ResultStore,
  type StructuredResult,
} from '@initlabs/vibekit/actions'
import { createActionViewModel } from '@initlabs/vibekit-explorer'
import { useCallback, useRef, useState } from 'react'

/** What the hook is doing right now; `idle` includes resting at `awaiting-approval`. */
export type ActionPhase = 'idle' | 'preparing' | 'deciding' | 'signing' | 'approved'

export type ActionNotice =
  /** A stage was reached; `store` holds its record. */
  | { kind: 'step'; store: ResultStore; flow: ActionState }
  | {
      kind: 'failed'
      store: ResultStore
      flow: ActionState | null
      message: string
      /** `preparing` and `completing` close the action; a failed decision leaves it awaiting approval. */
      while: 'preparing' | 'approve' | 'deny' | 'completing'
    }
  | { kind: 'denied'; store: ResultStore; flow: ActionState }
  /** Approved on a host without a signer: nothing was signed. */
  | { kind: 'paused'; store: ResultStore; flow: ActionState }
  | {
      kind: 'confirmed'
      store: ResultStore
      flow: ActionState
      confirmation?: { transactionId: string; confirmedRound: number }
    }

type Run = { ok: boolean; message?: string; pausedForSigner?: boolean; store: ResultStore; flow: ActionState | null }

export function useAction({
  host,
  store,
  newId,
  onNotice,
}: {
  /** The host at start time; the action finishes on it even if the app's host changes. */
  host: () => ActionHost
  /** The app's result store; commit `notice.store` from `onNotice` to keep it current. */
  store: { current: ResultStore }
  newId: (prefix: string) => string
  onNotice: (notice: ActionNotice) => void
}) {
  const [flow, setFlow] = useState<ActionState | null>(null)
  const [phase, setPhase] = useState<ActionPhase>('idle')
  const flowRef = useRef<ActionState | null>(null)
  const hostRef = useRef<ActionHost | null>(null)
  const busyRef = useRef(false)

  const commit = useCallback((next: ActionState | null) => {
    flowRef.current = next
    setFlow(next)
  }, [])
  const close = useCallback(() => {
    commit(null)
    hostRef.current = null
  }, [commit])
  const step = useCallback(
    (nextStore: ResultStore, next: ActionState) => {
      commit(next)
      onNotice({ kind: 'step', store: nextStore, flow: next })
    },
    [commit, onNotice],
  )

  /** Runs the mechanical stages to `awaiting-approval`. False when another action is open or busy. */
  const prepare = useCallback(
    (runner: (current: ActionHost) => Promise<Run>) => {
      if (busyRef.current || flowRef.current !== null) return false
      const current = host()
      hostRef.current = current
      busyRef.current = true
      setPhase('preparing')
      void runner(current).then((run) => {
        busyRef.current = false
        setPhase('idle')
        if (run.flow) commit(run.flow)
        if (!run.ok) {
          onNotice({ kind: 'failed', store: run.store, flow: run.flow, message: run.message ?? 'failed', while: 'preparing' })
          close()
        }
      })
      return true
    },
    [close, commit, host, onNotice],
  )

  const start = useCallback(
    (draft: ActionDraft) =>
      prepare((current) => startAction({ host: current, store: store.current, draft, newId, onStep: step })),
    [newId, prepare, step, store],
  )

  /** A draft composed elsewhere (an agent's tool call) joins at simulate. */
  const startFromDraft = useCallback(
    (draftRecord: StructuredResult) =>
      prepare((current) =>
        startActionFromDraft({ host: current, store: store.current, draftRecord, newId, onStep: step }),
      ),
    [newId, prepare, step, store],
  )

  const decide = useCallback(
    (decision: 'approve' | 'deny') => {
      const current = flowRef.current
      const on = hostRef.current
      if (busyRef.current || !current || !on || current.stage !== 'awaiting-approval') return false
      busyRef.current = true
      setPhase('deciding')
      void (async () => {
        const outcome = await performActionStep({ host: on, store: store.current, flow: current, kind: decision, newId })
        if (!outcome.ok) {
          busyRef.current = false
          setPhase('idle')
          onNotice({ kind: 'failed', store: store.current, flow: current, message: outcome.message, while: decision })
          return
        }
        step(outcome.store, outcome.flow)
        if (decision === 'deny') {
          busyRef.current = false
          setPhase('idle')
          onNotice({ kind: 'denied', store: outcome.store, flow: outcome.flow })
          close()
          return
        }
        setPhase(on.signDraft ? 'signing' : 'approved')
        const run = await submitAction({ host: on, store: outcome.store, flow: outcome.flow, newId, onStep: step })
        busyRef.current = false
        setPhase('idle')
        if (run.flow) commit(run.flow)
        if (!run.ok || !run.flow) {
          onNotice({ kind: 'failed', store: run.store, flow: run.flow, message: run.message ?? 'failed', while: 'completing' })
        } else if (run.pausedForSigner) {
          onNotice({ kind: 'paused', store: run.store, flow: run.flow })
        } else {
          const derived = createActionViewModel(run.store, run.flow)
          const confirmation = derived.ok ? derived.model.confirmation : undefined
          onNotice({ kind: 'confirmed', store: run.store, flow: run.flow, ...(confirmation ? { confirmation } : {}) })
        }
        close()
      })()
      return true
    },
    [close, commit, newId, onNotice, step, store],
  )

  return { flow, flowRef, phase, start, startFromDraft, decide, close }
}
