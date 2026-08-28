'use client'

/**
 * The web Explorer: one page holding the result store, the open view, and the
 * write flow. Reads and the flow run against the app's compose-only route
 * when localnet answers, and against the sample host when it does not; the
 * browser never holds a key, so a live flow rests at `approved`.
 */
import {
  addResult,
  completeApprovedWriteFlow,
  createAccountOpenView,
  createAccountPortfolioViewModel,
  createFixtureResultStore,
  createSampleHost,
  createTransactionDetailViewModel,
  createWriteFlowViewModel,
  FIXTURE_ADDRESS_BOOK,
  FIXTURE_RECEIVER,
  FIXTURE_SENDER,
  FIXTURE_TRANSACTION_ID,
  formatMicroAlgos,
  PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  performWriteFlowStep,
  startWriteFlow,
  type OpenView,
  type ResultStore,
  type WriteFlowState,
} from '@initlabs/vibekit-explorer'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { routeComposerInput } from '../src/commands'
import { createRemoteFlowHost, probeRemoteFlowHost } from '../src/remote-host'
import { Button } from '../src/primitives'
import { AccountsLanding, AccountView, TransactionDetail, Welcome } from '../src/views'
import { WriteFlowView } from '../src/write-flow'

export default function Page() {
  const remoteHost = useMemo(() => createRemoteFlowHost(), [])
  const sampleHost = useMemo(() => createSampleHost(), [])
  const [live, setLive] = useState<'probing' | boolean>('probing')
  const [store, setStore] = useState<ResultStore>(createFixtureResultStore)
  const [openView, setOpenView] = useState<OpenView | null>(null)
  const [flow, setFlow] = useState<WriteFlowState | null>(null)
  /** The host the open flow started on; a flow finishes where it began even if reachability flips. */
  const [flowHost, setFlowHost] = useState<typeof remoteHost | typeof sampleHost | null>(null)
  const [busy, setBusy] = useState(false)
  const [accountsOpen, setAccountsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('Ready')
  const newId = useCallback((prefix: string) => `${prefix}-${crypto.randomUUID()}`, [])
  const host = live === true ? remoteHost : sampleHost

  useEffect(() => {
    let cancelled = false
    probeRemoteFlowHost().then((reachable) => {
      if (!cancelled) setLive(reachable)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const startPayment = useCallback(
    (amountMicroAlgos?: number) => {
      if (busy) return
      if (flow !== null) {
        setStatus('A payment is already open — close it to start another')
        return
      }
      setFlowHost(host)
      setBusy(true)
      setStatus(
        host === remoteHost
          ? 'Preparing the payment on localnet…'
          : `Preparing a sample payment (always ${formatMicroAlgos(PAYMENT_FIXTURE_AMOUNT_MICROALGOS)} ALGO — localnet is offline)…`,
      )
      void startWriteFlow({
        host,
        store,
        draftParams: {
          sender: FIXTURE_SENDER,
          receiver: FIXTURE_RECEIVER,
          amountMicroAlgos: amountMicroAlgos ?? PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
          note: 'Explorer live payment',
        },
        newId,
        onStep: (nextStore, nextFlow) => {
          setStore(nextStore)
          setFlow(nextFlow)
        },
      }).then((run) => {
        setBusy(false)
        setStore(run.store)
        if (run.flow) setFlow(run.flow)
        setStatus(
          run.ok
            ? 'Review the payment, then approve or deny'
            : `Couldn't prepare the payment — ${run.message}`,
        )
      })
    },
    [busy, flow, host, newId, remoteHost, store],
  )

  const decide = useCallback(
    (decision: 'approve' | 'deny') => {
      if (busy || !flow || !flowHost || flow.stage !== 'awaiting-approval') return
      setBusy(true)
      void (async () => {
        const outcome = await performWriteFlowStep({
          host: flowHost,
          store,
          flow,
          kind: decision,
          newId,
        })
        if (!outcome.ok) {
          setBusy(false)
          setStatus(`Couldn't ${decision} — ${outcome.message}`)
          return
        }
        setStore(outcome.store)
        setFlow(outcome.flow)
        if (decision === 'deny') {
          setBusy(false)
          setStatus('Denied — nothing was signed')
          return
        }
        setStatus(flowHost === remoteHost ? 'Approved' : 'Approved · finishing the sample…')
        const run = await completeApprovedWriteFlow({
          host: flowHost,
          store: outcome.store,
          flow: outcome.flow,
          newId,
          onStep: (nextStore, nextFlow) => {
            setStore(nextStore)
            setFlow(nextFlow)
          },
        })
        setBusy(false)
        setStore(run.store)
        if (run.flow) setFlow(run.flow)
        setStatus(
          !run.ok
            ? `Approved, but completion failed — ${run.message}`
            : run.pausedForSigner
              ? 'Approved — signing lands with wallet integration'
              : 'Payment confirmed on-chain',
        )
      })()
    },
    [busy, flow, flowHost, newId, remoteHost, store],
  )

  const openAccount = useCallback(
    (address: string) => {
      if (busy) return
      setBusy(true)
      setStatus(`Looking up ${address.slice(0, 8)}…`)
      void host
        .lookupAccount(address)
        .then((record) => {
          setBusy(false)
          setStore((current) => addResult(current, record))
          setOpenView(createAccountOpenView(record))
          setAccountsOpen(false)
          setStatus('Account opened')
        })
        .catch((error: unknown) => {
          setBusy(false)
          setStatus(
            `Couldn't open the account — ${error instanceof Error ? error.message : String(error)}`,
          )
        })
    },
    [busy, host],
  )

  const submit = (raw: string) => {
    const outcome = routeComposerInput(raw)
    setInput('')
    if (outcome.status === 'payment') {
      startPayment(outcome.amountMicroAlgos)
    } else if (outcome.status === 'account') {
      openAccount(outcome.address)
    } else if (outcome.status === 'resolved') {
      setOpenView(outcome.artifact)
      setStatus(
        flow !== null
          ? 'Transaction opened in the background — close the payment flow to view it'
          : 'Transaction opened',
      )
    } else if (outcome.status === 'ambiguous') {
      setStatus(
        `${outcome.classification.value} could be an asset, app, or block — those views are coming soon`,
      )
    } else {
      setStatus('No match — enter a 52-character transaction ID or `pay 0.5`')
    }
  }

  const viewId = openView?.view.view
  const transaction =
    openView && viewId === 'transaction.detail'
      ? createTransactionDetailViewModel(store, openView.view)
      : undefined
  const account =
    openView && viewId === 'account.portfolio'
      ? createAccountPortfolioViewModel(store, openView.view)
      : undefined
  const flowView = flow ? createWriteFlowViewModel(store, flow) : undefined
  const flowModel = flowView?.ok ? flowView.model : undefined
  // The browser holds no custody: a live flow waits for wallet integration after approval.
  const terminalNote =
    flowHost === remoteHost && flowModel?.stage === 'approved' && !busy
      ? 'Approved · signing lands with wallet integration — nothing was signed'
      : flowModel?.stage === 'denied'
        ? 'Nothing was signed'
        : undefined
  const modeLabel =
    live === 'probing' ? 'probing localnet…' : live ? 'live · compose-only' : 'sample data'
  const canvas = accountsOpen && !flowView ? (
    <AccountsLanding
      accounts={FIXTURE_ADDRESS_BOOK}
      note="Wallet accounts arrive with wallet integration — these are the sample accounts."
      onOpen={openAccount}
    />
  ) : flowView ? (
    <WriteFlowView
      model={flowModel}
      errorMessage={flowView.ok ? undefined : flowView.error.message}
      canSign={flowHost === sampleHost}
      terminalNote={terminalNote}
      busy={busy}
      onApprove={() => decide('approve')}
      onDeny={() => decide('deny')}
      onClose={() => {
        setFlow(null)
        setFlowHost(null)
        setStatus('Payment panel closed')
      }}
    />
  ) : viewId === 'account.portfolio' ? (
    <AccountView model={account?.ok ? account.model : undefined} />
  ) : openView ? (
    <TransactionDetail
      model={transaction?.ok ? transaction.model : undefined}
      onOpenAccount={openAccount}
    />
  ) : (
    <Welcome onOpenSample={() => submit(FIXTURE_TRANSACTION_ID)} />
  )

  return (
    <main className="shell">
      <header className="top">
        <div className="top-row">
          <span className="brand">
            VIBEKIT <b>EXPLORER</b>
          </span>
          <span className="top-state">
            <span>
              <span className={`live-dot${live === true ? ' on' : ''}`}>{live === true ? '●' : '○'}</span>{' '}
              {modeLabel}
            </span>
            <span className="net net-localnet">localnet</span>
            <span className="muted">no wallet</span>
          </span>
        </div>
        <nav className="top-row tabs">
          <Button label="explore" active={!accountsOpen} onPress={() => setAccountsOpen(false)} />
          <Button label="accounts" active={accountsOpen} onPress={() => setAccountsOpen(true)} />
        </nav>
      </header>
      <div className="body">
        <aside className="nav">
          <span className="kicker">session</span>
          <button className={`nav-item${!accountsOpen && !flow ? ' on' : ''}`} onClick={() => setAccountsOpen(false)}>
            {openView?.title ?? 'explore'}
          </button>
          {flow ? <span className="nav-item on">payment</span> : null}
          <span className="kicker nav-gap">write</span>
          <button className="nav-item" onClick={() => startPayment()} disabled={flow !== null || busy}>
            send payment
          </button>
        </aside>
        <section className="feed">
          {canvas}
          {flow && openView ? <p className="note">{openView.title} · in background</p> : null}
        </section>
      </div>
      <footer className="composer-wrap">
        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault()
            submit(input)
          }}
        >
          <span>›</span>
          <input
            autoFocus
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="transaction id, address, or `pay 0.5`"
            aria-label="Explorer composer"
          />
          <Button type="submit" label="open" />
        </form>
        <div className="status-line" role="status" aria-live="polite">
          {status}
        </div>
      </footer>
    </main>
  )
}
