/** The feed's view of an action: the block it updates, the notes it leaves, the status line. */
import type { ResultStore, StructuredResult } from '@initlabs/vibekit-explorer'
import { useCallback, useEffect, useRef } from 'react'

import { useAction, type ActionNotice } from '../../components/action'
import { resolvePaymentParties, type WalletAccount } from '../../commands'
import type { Feed } from '../../feed/hooks'
import type { ExplorerHost } from '../network/hooks'

const PREPARE_FAILED = { typed: "Couldn't prepare the payment", agent: "The agent's write failed" }

export function useActionFeed({
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
  networkRef: { current: string }
  accounts: ReadonlyArray<WalletAccount>
  activeAddress: string | undefined
  busyRef: { current: boolean }
  setBusy: (busy: boolean) => void
  setStatus: (status: string) => void
}) {
  const { appendBlock, appendNote, updateItem } = feed
  const sectionRef = useRef<number | null>(null)
  const blockRef = useRef<{ sectionId: number; itemId: number } | null>(null)
  const originRef = useRef<'typed' | 'agent'>('typed')

  const onNotice = useCallback(
    (notice: ActionNotice) => {
      commitStore(notice.store)
      const sectionId = sectionRef.current
      if (notice.kind === 'step') {
        const block = blockRef.current
        if (block) {
          updateItem(block.sectionId, block.itemId, (item) =>
            item.kind === 'block' ? { ...item, block: { kind: 'action', flow: notice.flow } } : item,
          )
        } else if (sectionId !== null) {
          blockRef.current = { sectionId, itemId: appendBlock(sectionId, { kind: 'action', flow: notice.flow }) }
        }
        return
      }
      if (sectionId === null) return
      switch (notice.kind) {
        case 'failed':
          if (notice.while === 'approve' || notice.while === 'deny') {
            appendNote(sectionId, `Couldn't ${notice.while} — ${notice.message}`, 'error')
            return // still awaiting approval
          }
          appendNote(
            sectionId,
            `${notice.while === 'preparing' ? PREPARE_FAILED[originRef.current] : 'Approved, but completion failed'} — ${notice.message}`,
            'error',
          )
          break
        case 'denied':
          appendNote(sectionId, 'Denied — nothing was signed.')
          break
        case 'paused':
          appendNote(sectionId, 'Approved — connect a wallet to sign; nothing was signed.')
          break
        case 'confirmed': {
          const { confirmation } = notice
          // Her line, bright-faced: the round and the transaction id, which copies.
          appendNote(
            sectionId,
            `confirmed${confirmation ? ` in round ${confirmation.confirmedRound}` : ''} — it's on-chain.${confirmation ? ' txn' : ''}`,
            'agent',
            { mood: 'bright', ...(confirmation ? { copy: confirmation.transactionId } : {}) },
          )
        }
      }
      sectionRef.current = null
      blockRef.current = null
    },
    [appendBlock, appendNote, commitStore, updateItem],
  )

  const action = useAction({ host, store: storeRef, newId, onNotice })
  const { phase } = action

  useEffect(() => {
    if (phase === 'idle') {
      setBusy(false)
      setStatus('')
    } else if (phase === 'signing') setStatus('signing…')
    else if (phase === 'approved') setStatus('approved')
  }, [phase, setBusy, setStatus])

  const startPayment = useCallback(
    (sectionId: number, amountMicroAlgos: number, to?: string) => {
      if (busyRef.current || action.flowRef.current !== null) {
        appendNote(sectionId, 'A payment is already in progress.', 'error')
        return
      }
      const parties = resolvePaymentParties({ live: live === true, accounts, activeAddress, to })
      if ('error' in parties) {
        appendNote(sectionId, parties.error, 'error')
        return
      }
      sectionRef.current = sectionId
      originRef.current = 'typed'
      setBusy(true)
      setStatus(
        live === true
          ? `composing and simulating on ${networkRef.current}…`
          : `preparing a sample payment (${networkRef.current} is unreachable)…`,
      )
      action.start({ toolName: 'send_payment', args: { ...parties, amountMicroAlgos, note: 'Explorer live payment' } })
    },
    [accounts, action, activeAddress, appendNote, busyRef, live, networkRef, setBusy, setStatus],
  )

  /** A draft composed elsewhere (the agent) joins the same flow at simulate. */
  const startFromDraft = useCallback(
    (sectionId: number, draftRecord: StructuredResult) => {
      if (action.flowRef.current !== null) {
        appendNote(sectionId, 'A write is already awaiting approval; decide that one first.', 'error')
        return
      }
      sectionRef.current = sectionId
      originRef.current = 'agent'
      setBusy(true)
      setStatus(`simulating on ${networkRef.current}…`)
      action.startFromDraft(draftRecord)
    },
    [action, appendNote, networkRef, setBusy, setStatus],
  )

  const decide = useCallback(
    (decision: 'approve' | 'deny') => {
      if (busyRef.current) return
      if (action.decide(decision)) setBusy(true)
    },
    [action, busyRef, setBusy],
  )

  return { flow: action.flow, flowRef: action.flowRef, startPayment, startFromDraft, decide, closeFlow: action.close }
}
