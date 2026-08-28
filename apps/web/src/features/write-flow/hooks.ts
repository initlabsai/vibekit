/** The payment write flow: start/decide orchestration and the flow block in the feed. */
import {
  completeApprovedWriteFlow,
  createWriteFlowViewModel,
  performWriteFlowStep,
  startWriteFlow,
  startWriteFlowFromDraft,
  type StructuredResult,
  type LiveNetworkId,
  type ResultStore,
  type WriteFlowState,
} from '@initlabs/vibekit-explorer'
import { useCallback, useRef, useState } from 'react'

import { resolvePaymentParties, type WalletAccount } from '../../commands'
import type { Feed } from '../../feed/hooks'
import type { ExplorerHost } from '../network/hooks'

export function useWriteFlow({
  feed,
  storeRef,
  commitStore,
  host,
  newId,
  live,
  networkRef,
  accounts,
  activeAddress,
  busyRef,
  setBusy,
  setStatus,
}: {
  feed: Feed
  storeRef: { current: ResultStore }
  commitStore: (next: ResultStore) => void
  host: () => ExplorerHost
  newId: (prefix: string) => string
  live: 'probing' | boolean
  networkRef: { current: LiveNetworkId }
  accounts: ReadonlyArray<WalletAccount>
  activeAddress: string | undefined
  busyRef: { current: boolean }
  setBusy: (busy: boolean) => void
  setStatus: (status: string) => void
}) {
  const { appendBlock, appendNote, updateItem } = feed
  const [flow, setFlow] = useState<WriteFlowState | null>(null)
  const flowRef = useRef<WriteFlowState | null>(null)
  /** The host the open flow started on; a flow finishes where it began even if reachability flips. */
  const flowHostRef = useRef<ExplorerHost | null>(null)
  const flowBlockRef = useRef<{ sectionId: number; itemId: number } | null>(null)

  const commitFlow = useCallback(
    (next: WriteFlowState | null) => {
      flowRef.current = next
      setFlow(next)
      const block = flowBlockRef.current
      if (next && block) {
        updateItem(block.sectionId, block.itemId, (item) =>
          item.kind === 'block' ? { ...item, block: { kind: 'write', flow: next } } : item,
        )
      }
    },
    [updateItem],
  )

  const trackStep = useCallback(
    (sectionId: number) => (store: ResultStore, next: WriteFlowState) => {
      commitStore(store)
      if (!flowBlockRef.current) {
        flowBlockRef.current = { sectionId, itemId: appendBlock(sectionId, { kind: 'write', flow: next }) }
      }
      commitFlow(next)
    },
    [appendBlock, commitFlow, commitStore],
  )

  const closeFlow = useCallback(() => {
    flowRef.current = null
    flowHostRef.current = null
    flowBlockRef.current = null
    setFlow(null)
  }, [])

  const startPayment = useCallback(
    (sectionId: number, amountMicroAlgos: number, to?: string) => {
      if (busyRef.current || flowRef.current !== null) {
        appendNote(sectionId, 'A payment is already in progress.', 'error')
        return
      }
      const parties = resolvePaymentParties({ live: live === true, accounts, activeAddress, to })
      if ('error' in parties) {
        appendNote(sectionId, parties.error, 'error')
        return
      }
      const current = host()
      flowHostRef.current = current
      setBusy(true)
      setStatus(
        live === true
          ? `composing and simulating on ${networkRef.current}…`
          : `preparing a sample payment (${networkRef.current} is unreachable)…`,
      )
      void startWriteFlow({
        host: current,
        store: storeRef.current,
        draftParams: { ...parties, amountMicroAlgos, note: 'Explorer live payment' },
        newId,
        onStep: trackStep(sectionId),
      }).then((run) => {
        commitStore(run.store)
        setBusy(false)
        setStatus('')
        if (!run.ok) {
          appendNote(sectionId, `Couldn't prepare the payment — ${run.message}`, 'error')
          if (run.flow) commitFlow(run.flow)
          closeFlow()
          return
        }
        if (run.flow) commitFlow(run.flow)
      })
    },
    [accounts, activeAddress, appendNote, busyRef, closeFlow, commitFlow, commitStore, host, live, networkRef, newId, setBusy, setStatus, storeRef, trackStep],
  )

  /** A draft composed elsewhere (the agent) joins the same flow at simulate. */
  const startFromDraft = useCallback(
    (sectionId: number, draftRecord: StructuredResult) => {
      if (flowRef.current !== null) {
        appendNote(sectionId, 'A write is already awaiting approval; decide that one first.', 'error')
        return
      }
      const current = host()
      flowHostRef.current = current
      setBusy(true)
      setStatus(`simulating on ${networkRef.current}…`)
      void startWriteFlowFromDraft({
        host: current,
        store: storeRef.current,
        draftRecord,
        newId,
        onStep: trackStep(sectionId),
      }).then((run) => {
        commitStore(run.store)
        setBusy(false)
        setStatus('')
        if (!run.ok) {
          appendNote(sectionId, `The agent's write failed — ${run.message}`, 'error')
          if (run.flow) commitFlow(run.flow)
          closeFlow()
          return
        }
        if (run.flow) commitFlow(run.flow)
      })
    },
    [appendNote, closeFlow, commitFlow, commitStore, host, networkRef, newId, setBusy, setStatus, storeRef, trackStep],
  )

  const decide = useCallback(
    (decision: 'approve' | 'deny') => {
      const current = flowRef.current
      const flowHost = flowHostRef.current
      const block = flowBlockRef.current
      if (busyRef.current || !current || !flowHost || !block || current.stage !== 'awaiting-approval') return
      setBusy(true)
      void (async () => {
        const outcome = await performWriteFlowStep({
          host: flowHost,
          store: storeRef.current,
          flow: current,
          kind: decision,
          newId,
        })
        if (!outcome.ok) {
          setBusy(false)
          appendNote(block.sectionId, `Couldn't ${decision} — ${outcome.message}`, 'error')
          return
        }
        commitStore(outcome.store)
        commitFlow(outcome.flow)
        if (decision === 'deny') {
          setBusy(false)
          appendNote(block.sectionId, 'Denied — nothing was signed.')
          closeFlow()
          return
        }
        setStatus(flowHost.signDraft ? 'signing…' : 'approved')
        const run = await completeApprovedWriteFlow({
          host: flowHost,
          store: outcome.store,
          flow: outcome.flow,
          newId,
          onStep: (store, next) => {
            commitStore(store)
            commitFlow(next)
          },
        })
        setBusy(false)
        setStatus('')
        commitStore(run.store)
        if (run.flow) commitFlow(run.flow)
        if (!run.ok) {
          appendNote(block.sectionId, `Approved, but completion failed — ${run.message}`, 'error')
        } else if (run.pausedForSigner) {
          appendNote(block.sectionId, 'Approved — connect a wallet to sign; nothing was signed.')
        } else {
          const derived = run.flow ? createWriteFlowViewModel(run.store, run.flow) : undefined
          const round = derived?.ok ? derived.model.confirmation?.confirmedRound : undefined
          appendNote(block.sectionId, `Payment confirmed on-chain${round === undefined ? '' : ` in round ${round}`}.`)
        }
        closeFlow()
      })()
    },
    [appendNote, busyRef, closeFlow, commitFlow, commitStore, newId, setBusy, setStatus, storeRef],
  )

  return { flow, flowRef, startPayment, startFromDraft, decide, closeFlow }
}
