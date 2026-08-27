import {
  completeApprovedPaymentFlow,
  createPaymentFlowViewModel,
  PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  performLivePaymentStep,
  startPaymentFlow,
  type ResultStore,
  type WriteFlowState,
} from '@initlabs/vibekit-explorer'
import type { LiveNetworkId } from '@initlabs/vibekit-explorer/live'
import { useCallback, useMemo, useRef, useState } from 'react'

import { resolvePaymentParties } from '../commands.js'
import type { Feed } from './feed.js'
import type { ExplorerHost } from './network.js'

/**
 * Owns the payment write flow: start/decide orchestration, the flow block in
 * the feed, and the approval modal's derived model.
 */
export function usePaymentFlow({
  feed,
  store,
  storeRef,
  commitStore,
  host,
  newId,
  live,
  networkRef,
  accountList,
  activeSender,
  busy,
  busyRef,
  setBusy,
  setStatus,
}: {
  feed: Feed
  store: ResultStore
  storeRef: { current: ResultStore }
  commitStore: (next: ResultStore) => void
  host: () => ExplorerHost
  newId: (prefix: string) => string
  live: 'probing' | boolean
  networkRef: { current: LiveNetworkId }
  accountList: ReadonlyArray<{ address: string; name?: string }>
  activeSender: string | undefined
  /** Render-time busy, for the modal; guards read `busyRef`. */
  busy: boolean
  busyRef: { current: boolean }
  setBusy: (busy: boolean) => void
  setStatus: (status: string) => void
}) {
  const { appendBlock, appendNote, updateItem } = feed

  const [flow, setFlow] = useState<WriteFlowState | null>(null)
  const [flowMode, setFlowMode] = useState<'live' | 'sample'>('sample')
  /** Who composed the group under review: the agent, or the user's own typed command/method line. */
  const [flowOrigin, setFlowOrigin] = useState<'agent' | 'typed'>('typed')
  const flowRef = useRef<WriteFlowState | null>(flow)
  const flowSectionRef = useRef<number | null>(null)
  const flowItemRef = useRef<number | null>(null)
  flowRef.current = flow

  const updateFlowBlock = useCallback(
    (nextFlow: WriteFlowState) => {
      flowRef.current = nextFlow
      setFlow(nextFlow)
      const targetSection = flowSectionRef.current
      const targetItem = flowItemRef.current
      if (targetSection === null || targetItem === null) return
      updateItem(targetSection, targetItem, (item) =>
        item.kind === 'block' && item.block.kind === 'payment'
          ? { ...item, block: { ...item.block, flow: nextFlow } }
          : item,
      )
    },
    [updateItem],
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
    [appendNote, setBusy, setStatus, updateFlowBlock],
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
    (sectionId: number, amountMicroAlgos?: number, to?: string) => {
      if (busyRef.current || flowRef.current !== null) {
        appendNote(sectionId, 'A payment is already in progress.', 'error')
        return
      }
      const parties = resolvePaymentParties(accountList, activeSender, to)
      if ('error' in parties) {
        appendNote(sectionId, parties.error, 'error')
        return
      }
      const useLive = live === true
      setFlowMode(useLive ? 'live' : 'sample')
      setFlowOrigin('typed')
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
          ...parties,
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
      busyRef,
      commitStore,
      finishPayment,
      host,
      live,
      networkRef,
      newId,
      setBusy,
      setStatus,
      storeRef,
      trackFlowStep,
      updateFlowBlock,
    ],
  )

  const decide = useCallback(
    (decision: 'approve' | 'deny') => {
      const current = flowRef.current
      const sectionId = flowSectionRef.current
      if (
        busyRef.current ||
        !current ||
        current.stage !== 'awaiting-approval' ||
        sectionId === null
      )
        return
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
          const types =
            derived && derived.ok ? derived.model.simulation?.transactionTypes : undefined
          const create =
            derived && derived.ok && derived.model.unsignedGroup.summary.startsWith('create app')
          const what = create
            ? 'Deploy'
            : types?.length === 1
              ? types[0] === 'pay'
                ? 'Payment'
                : types[0] === 'appl'
                  ? 'Call'
                  : 'Transaction'
              : 'Group'
          finishPayment(
            run.flow,
            `${what} confirmed on-chain${round === undefined ? '' : ` in round ${round}`}.`,
          )
        })
      })
    },
    [
      appendNote,
      busyRef,
      commitStore,
      finishPayment,
      flowMode,
      host,
      newId,
      setBusy,
      setStatus,
      storeRef,
      updateFlowBlock,
    ],
  )

  /** True when this feed section holds the in-flight payment block. */
  const isFlowSection = useCallback(
    (sectionId: number) => flowRef.current !== null && flowSectionRef.current === sectionId,
    [],
  )

  const modalOpen = flow?.stage === 'awaiting-approval' && !busy

  const modalModel = useMemo(() => {
    if (!modalOpen || !flow) return undefined
    const derived = createPaymentFlowViewModel(store, flow)
    return derived.ok ? derived.model : undefined
  }, [flow, modalOpen, store])

  return {
    flow,
    flowRef,
    flowOrigin,
    setFlowMode,
    setFlowOrigin,
    startPayment,
    decide,
    updateFlowBlock,
    finishPayment,
    trackFlowStep,
    isFlowSection,
    modalOpen,
    modalModel,
  }
}

export type PaymentLane = ReturnType<typeof usePaymentFlow>
