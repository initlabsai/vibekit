import {
  submitAction,
  createActionViewModel,
  PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  performActionStep,
  startAction,
  startActionFromDraft,
  type ResultStore,
  type StructuredResult,
  type ActionState,
} from '@initlabs/vibekit/views'
import type { LiveNetworkId } from '@initlabs/vibekit/live'
import { useCallback, useMemo, useRef, useState } from 'react'

import { resolvePaymentParties } from '../../commands.js'
import type { Feed } from '../../feed/hooks.js'
import type { ExplorerHost } from '../network/hooks.js'
import type { KeystorePaymentHost } from '../network/keystore-host.js'

/** "Payment confirmed on-chain in round N." — the noun comes from what the group held. */
function confirmedNote(store: ResultStore, flow: ActionState | null): string {
  const derived = flow?.stage === 'confirmed' ? createActionViewModel(store, flow) : undefined
  const model = derived?.ok ? derived.model : undefined
  const types = model?.simulation?.transactionTypes
  const what = model?.unsignedGroup.summary.startsWith('create app')
    ? 'Deploy'
    : types?.length !== 1
      ? 'Group'
      : types[0] === 'pay'
        ? 'Payment'
        : types[0] === 'appl'
          ? 'Call'
          : 'Transaction'
  const round = model?.confirmation?.confirmedRound
  return `${what} confirmed on-chain${round === undefined ? '' : ` in round ${round}`}.`
}

/**
 * Owns the payment action flow: start/decide orchestration, the flow block in
 * the feed, and the approval modal's derived model.
 */
export function useAction({
  feed,
  store,
  storeRef,
  commitStore,
  host,
  keystoreHost,
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
  /** Drafts composed elsewhere (agent, method line) always run live: they carry real group bytes. */
  keystoreHost: KeystorePaymentHost
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

  const [flow, setFlow] = useState<ActionState | null>(null)
  /** Who composed the group under review: the agent, or the user's own typed command/method line. */
  const [flowOrigin, setFlowOrigin] = useState<'agent' | 'typed'>('typed')
  const flowRef = useRef<ActionState | null>(flow)
  const flowSectionRef = useRef<number | null>(null)
  const flowItemRef = useRef<number | null>(null)
  flowRef.current = flow

  const updateFlowBlock = useCallback(
    (nextFlow: ActionState) => {
      flowRef.current = nextFlow
      setFlow(nextFlow)
      const targetSection = flowSectionRef.current
      const targetItem = flowItemRef.current
      if (targetSection === null || targetItem === null) return
      updateItem(targetSection, targetItem, (item) =>
        item.kind === 'block' && item.block.kind === 'action'
          ? { ...item, block: { ...item.block, flow: nextFlow } }
          : item,
      )
    },
    [updateItem],
  )

  const finishFlow = useCallback(
    (finalFlow: ActionState | null, message: string, tone: 'muted' | 'error' = 'muted') => {
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
    (sectionId: number) => (nextStore: ResultStore, nextFlow: ActionState) => {
      commitStore(nextStore)
      if (flowSectionRef.current === null) {
        flowSectionRef.current = sectionId
        flowItemRef.current = appendBlock(sectionId, { kind: 'action', flow: nextFlow })
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
      setFlowOrigin('typed')
      setBusy(true)
      setStatus(
        useLive
          ? `composing and simulating on ${networkRef.current}…`
          : `preparing a sample payment (always 0.25 ALGO — ${networkRef.current} is offline)…`,
      )
      void startAction({
        host: host(),
        store: storeRef.current,
        draft: {
          toolName: 'send_payment',
          args: {
            ...parties,
            amountMicroAlgos: amountMicroAlgos ?? PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
            note: 'Explorer live payment',
          },
        },
        newId,
        onStep: trackFlowStep(sectionId),
      }).then((run) => {
        commitStore(run.store)
        setBusy(false)
        if (!run.ok) {
          finishFlow(run.flow, `Couldn't prepare the payment — ${run.message}`, 'error')
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
      finishFlow,
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

  /**
   * Starts the approval flow from a draft composed elsewhere: an agent tool
   * result or a method-line call. The one path for both, so failure handling
   * cannot drift between them.
   */
  const startFromDraft = useCallback(
    (
      sectionId: number,
      draftRecord: StructuredResult,
      origin: 'agent' | 'typed',
      failurePrefix: string,
    ) => {
      setFlowOrigin(origin)
      void startActionFromDraft({
        host: keystoreHost,
        store: storeRef.current,
        draftRecord,
        newId,
        onStep: trackFlowStep(sectionId),
      }).then((run) => {
        commitStore(run.store)
        if (!run.ok) {
          const message = `${failurePrefix} — ${run.message}`
          // finishFlow notes into the section a flow step reached; a failure
          // before the first step (the store refusing the draft) has no flow yet.
          if (run.flow) finishFlow(run.flow, message, 'error')
          else appendNote(sectionId, message, 'error')
        } else if (run.flow) updateFlowBlock(run.flow)
      })
    },
    [
      appendNote,
      commitStore,
      finishFlow,
      keystoreHost,
      newId,
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
      void (async () => {
        const outcome = await performActionStep({
          host: host(),
          store: storeRef.current,
          flow: current,
          kind: decision,
          newId,
        })
        if (!outcome.ok) {
          setBusy(false)
          appendNote(sectionId, `Couldn't ${decision} — ${outcome.message}`, 'error')
          return
        }
        commitStore(outcome.store)
        updateFlowBlock(outcome.flow)
        if (decision === 'deny') {
          finishFlow(outcome.flow, 'Denied — nothing was signed.')
          return
        }
        setStatus(live === true ? 'signing and submitting…' : 'finishing the sample…')
        const run = await submitAction({
          host: host(),
          store: outcome.store,
          flow: outcome.flow,
          newId,
          onStep: (nextStore, nextFlow) => {
            commitStore(nextStore)
            updateFlowBlock(nextFlow)
          },
        })
        commitStore(run.store)
        if (!run.ok) {
          finishFlow(run.flow, `Approved, but completion failed — ${run.message}`, 'error')
        } else if (run.pausedForSigner) {
          finishFlow(run.flow, 'Approved — signing is unavailable without the keystore daemon.')
        } else {
          finishFlow(run.flow, confirmedNote(run.store, run.flow))
        }
      })()
    },
    [
      appendNote,
      busyRef,
      commitStore,
      finishFlow,
      host,
      live,
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
    const derived = createActionViewModel(store, flow)
    return derived.ok ? derived.model : undefined
  }, [flow, modalOpen, store])

  return {
    flow,
    flowRef,
    flowOrigin,
    setFlowOrigin,
    startPayment,
    startFromDraft,
    decide,
    updateFlowBlock,
    finishFlow,
    trackFlowStep,
    isFlowSection,
    modalOpen,
    modalModel,
  }
}

export type Action = ReturnType<typeof useAction>
