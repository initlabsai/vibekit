'use client'

import {
  addResult,
  completeApprovedPaymentFlow,
  createAccountOpenView,
  createAccountPortfolioViewModel,
  createFixturePaymentHost,
  createFixtureResultStore,
  createPaymentFlowViewModel,
  createTransactionDetailViewModel,
  FIXTURE_ADDRESS_BOOK,
  formatMicroAlgos,
  FIXTURE_RECEIVER,
  FIXTURE_SENDER,
  FIXTURE_TRANSACTION_ID,
  PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  performLivePaymentStep,
  startPaymentFlow,
  type AccountLookupHost,
  type AccountPortfolioViewModel,
  type OpenView,
  type PaymentFlowHost,
  type PaymentFlowViewModel,
  type ResultStore,
  type TransactionDetailViewModel,
  type WriteFlowState,
} from '@initlabs/vibekit-explorer'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { routeComposerInput } from '../src/commands'
import { createRemoteFlowHost, probeRemoteFlowHost } from '../src/remote-host'

function shorten(value: string, width: number) {
  if (value.length <= width) return value
  return `${value.slice(0, Math.ceil((width - 1) / 2))}…${value.slice(-Math.floor((width - 1) / 2))}`
}

function Detail({
  model,
  onOpenSample,
  onOpenAccount,
}: {
  model: TransactionDetailViewModel | undefined
  onOpenSample: () => void
  onOpenAccount: (address: string) => void
}) {
  if (!model) {
    return (
      <section className="canvas empty">
        <p className="kicker">EXPLORER WORKSPACE</p>
        <h1>Explore Algorand</h1>
        <p>
          Look up a transaction by ID, or type <code>pay 0.5</code> below to walk a payment from
          draft to approval.
        </p>
        <div className="flow-actions">
          <button onClick={onOpenSample}>Open the sample transaction</button>
        </div>
      </section>
    )
  }
  return (
    <section className="canvas">
      <div className="section-heading">
        <div>
          <p className="kicker">TRANSACTION DETAIL</p>
          <h1>{model.type} transaction</h1>
        </div>
        <span className="status">{model.status}</span>
      </div>
      <p className="authoritative">Authoritative result · {model.network}</p>
      <dl className="facts">
        <div>
          <dt>ID</dt>
          <dd>{model.id}</dd>
        </div>
        <div>
          <dt>Sender</dt>
          <dd>
            {model.sender}{' '}
            <button className="inline-open" onClick={() => onOpenAccount(model.sender)}>
              open account
            </button>
          </dd>
        </div>
        <div>
          <dt>Receiver</dt>
          <dd>
            {model.receiver ?? '—'}{' '}
            {model.receiver ? (
              <button className="inline-open" onClick={() => onOpenAccount(model.receiver!)}>
                open account
              </button>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>
            {model.amountMicroAlgos === undefined
              ? '—'
              : `${formatMicroAlgos(model.amountMicroAlgos)} ALGO`}
          </dd>
        </div>
        <div>
          <dt>Fee</dt>
          <dd>{formatMicroAlgos(model.feeMicroAlgos)} ALGO</dd>
        </div>
        <div>
          <dt>Confirmed round</dt>
          <dd>{model.confirmedRound ?? '—'}</dd>
        </div>
      </dl>
    </section>
  )
}

function AccountView({ model }: { model: AccountPortfolioViewModel | undefined }) {
  if (!model) {
    return (
      <section className="canvas empty">
        <p className="kicker">ACCOUNT</p>
        <h1>Account unavailable</h1>
        <p>The account record could not be derived.</p>
      </section>
    )
  }
  return (
    <section className="canvas">
      <div className="section-heading">
        <div>
          <p className="kicker">ACCOUNT</p>
          <h1>{formatMicroAlgos(model.balanceMicroAlgos)} ALGO</h1>
        </div>
        <span className="status">{model.network}</span>
      </div>
      <dl className="facts">
        <div>
          <dt>Address</dt>
          <dd>{model.address}</dd>
        </div>
        <div>
          <dt>Balance</dt>
          <dd>{formatMicroAlgos(model.balanceMicroAlgos)} ALGO</dd>
        </div>
        <div>
          <dt>Assets</dt>
          <dd>
            {model.totalAssets === 0
              ? 'No asset holdings'
              : model.assets.map((asset) => (
                  <span key={String(asset.assetId)} className="effect">
                    {String(asset.assetId)} · {asset.name ?? '—'} · {String(asset.amount)}
                    {asset.unitName ? ` ${asset.unitName}` : ''}
                    {asset.isFrozen ? ' · frozen' : ''}
                  </span>
                ))}
          </dd>
        </div>
      </dl>
    </section>
  )
}

function AccountsLanding({
  accounts,
  note,
  onOpen,
}: {
  accounts: ReadonlyArray<{ address: string; name?: string }>
  note: string
  onOpen: (address: string) => void
}) {
  return (
    <section className="canvas">
      <div className="section-heading">
        <div>
          <p className="kicker">ACCOUNTS</p>
          <h1>Your accounts</h1>
        </div>
      </div>
      <p className="authoritative">{note}</p>
      <div className="flow-actions account-rows">
        {accounts.map((account) => (
          <button key={account.address} onClick={() => onOpen(account.address)}>
            {account.name ?? 'Account'} <span className="group-bytes">{account.address}</span>
          </button>
        ))}
      </div>
      <p className="authoritative">Or paste any address into the composer below.</p>
    </section>
  )
}

const FLOW_STEPS: Array<{ label: string; stages: PaymentFlowViewModel['stage'][] }> = [
  { label: 'Draft', stages: ['drafted'] },
  { label: 'Simulate', stages: ['simulated'] },
  { label: 'Inspect', stages: ['inspected'] },
  { label: 'Approval', stages: ['awaiting-approval', 'approved', 'denied'] },
  { label: 'Sign', stages: ['signed'] },
  { label: 'Confirm', stages: ['confirmed'] },
]

function PaymentFlow({
  model,
  errorMessage,
  canSign,
  terminalNote,
  busy,
  onApprove,
  onDeny,
  onClose,
}: {
  model: PaymentFlowViewModel | undefined
  errorMessage: string | undefined
  canSign: boolean
  terminalNote: string | undefined
  busy: boolean
  onApprove: () => void
  onDeny: () => void
  onClose: () => void
}) {
  if (!model) {
    return (
      <section className="canvas empty">
        <p className="kicker">PAYMENT</p>
        <h1>Payment unavailable</h1>
        <p>{errorMessage ?? 'The flow references no known result.'}</p>
        <div className="flow-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </section>
    )
  }

  const currentIndex = FLOW_STEPS.findIndex((step) => step.stages.includes(model.stage))
  const awaiting = model.stage === 'awaiting-approval'
  const failed = model.simulation?.wouldSucceed === false
  const badge = busy
    ? 'working…'
    : awaiting
      ? 'awaiting your approval'
      : model.stage.replace('-', ' ')
  return (
    <section className="canvas">
      <div className="section-heading">
        <div>
          <p className="kicker">PAYMENT</p>
          <h1>
            {model.amountMicroAlgos === undefined
              ? model.unsignedGroup.summary
              : `${formatMicroAlgos(model.amountMicroAlgos)} ALGO payment`}
          </h1>
        </div>
        <span className={`status ${model.stage === 'denied' || failed ? 'status-denied' : ''}`}>
          {badge}
        </span>
      </div>
      <p className="authoritative">Authoritative result · {model.network}</p>
      <ol className="flow-steps">
        {FLOW_STEPS.map((step, index) => (
          <li
            key={step.label}
            className={
              index < currentIndex ? 'done' : index === currentIndex ? 'current' : undefined
            }
          >
            {step.label}
          </li>
        ))}
      </ol>
      <dl className="facts">
        <div>
          <dt>Sender</dt>
          <dd>{model.sender}</dd>
        </div>
        {model.receiver ? (
          <div>
            <dt>Receiver</dt>
            <dd>{model.receiver}</dd>
          </div>
        ) : null}
        {model.amountMicroAlgos === undefined ? null : (
          <div>
            <dt>Amount</dt>
            <dd>{formatMicroAlgos(model.amountMicroAlgos)} ALGO</dd>
          </div>
        )}
        {model.note ? (
          <div>
            <dt>Note</dt>
            <dd>{model.note}</dd>
          </div>
        ) : null}
        <div>
          <dt>Unsigned group</dt>
          <dd>
            {model.unsignedGroup.size} transaction{model.unsignedGroup.size === 1 ? '' : 's'} ·{' '}
            <span className="group-bytes">{shorten(model.unsignedGroup.transactions[0]!, 44)}</span>
            <span className="effect">{model.unsignedGroup.summary}</span>
          </dd>
        </div>
        {model.simulation ? (
          <>
            <div>
              <dt>Simulation</dt>
              <dd>
                {model.simulation.wouldSucceed ? 'Would succeed' : 'Would fail'}
                {model.simulation.simulatedRound === undefined
                  ? ''
                  : ` · round ${model.simulation.simulatedRound}`}
                {model.simulation.failureMessage
                  ? ` · ${shorten(model.simulation.failureMessage, 140)}`
                  : ''}
              </dd>
            </div>
            <div>
              <dt>Fee</dt>
              <dd>{formatMicroAlgos(model.simulation.feeMicroAlgos)} ALGO</dd>
            </div>
            <div>
              <dt>Group</dt>
              <dd>
                {model.simulation.groupSize} × {model.simulation.transactionTypes.join(', ')}
              </dd>
            </div>
            <div>
              <dt>Effects</dt>
              <dd>
                {model.simulation.effects.map((effect) => {
                  const delta = formatMicroAlgos(effect.deltaMicroAlgos)
                  const signed = delta.startsWith('-') || delta === '0' ? delta : `+${delta}`
                  return (
                    <span key={effect.account} className="effect">
                      {effect.role} {signed} ALGO · {shorten(effect.account, 20)}
                    </span>
                  )
                })}
              </dd>
            </div>
          </>
        ) : null}
        {model.approval ? (
          <div>
            <dt>Approval</dt>
            <dd>
              {model.approval.state} · {model.approval.requestId}
              {model.approval.reason ? ` · ${model.approval.reason}` : ''}
            </dd>
          </div>
        ) : null}
        {model.signed ? (
          <div>
            <dt>Signed</dt>
            <dd>
              by {shorten(model.signed.signer, 20)} · txId {model.signed.txIds[0]}
            </dd>
          </div>
        ) : null}
        {model.confirmation ? (
          <div>
            <dt>Confirmed</dt>
            <dd>
              round {model.confirmation.confirmedRound} · {model.confirmation.transactionId}
            </dd>
          </div>
        ) : null}
      </dl>
      {model.simulation && !model.simulation.wouldSucceed ? (
        <p className="flow-warning">
          Simulation failed — the chain will reject this payment if it is signed and submitted.
        </p>
      ) : null}
      {terminalNote ? <p className="authoritative">{terminalNote}</p> : null}
      <div className="flow-actions">
        {awaiting ? (
          <>
            <button className="approve" disabled={busy} onClick={onApprove}>
              {failed ? 'Approve anyway' : canSign ? 'Approve & send' : 'Approve'}
            </button>
            <button className="deny" disabled={busy} onClick={onDeny}>
              Deny
            </button>
          </>
        ) : busy ? null : (
          <button onClick={onClose}>Close</button>
        )}
      </div>
    </section>
  )
}

export default function Page() {
  const remoteHost = useMemo(() => createRemoteFlowHost(), [])
  const sampleHost = useMemo(() => createFixturePaymentHost(), [])
  const [live, setLive] = useState<'probing' | boolean>('probing')
  const [store, setStore] = useState<ResultStore>(createFixtureResultStore)
  const [artifact, setArtifact] = useState<OpenView | null>(null)
  const [flow, setFlow] = useState<WriteFlowState | null>(null)
  const [flowMode, setFlowMode] = useState<'live' | 'sample'>('sample')
  const [busy, setBusy] = useState(false)
  const [accountsOpen, setAccountsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('Ready')
  const newId = useCallback((prefix: string) => `${prefix}-${crypto.randomUUID()}`, [])

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
      const useLive = live === true
      const host: PaymentFlowHost = useLive ? remoteHost : sampleHost
      setFlowMode(useLive ? 'live' : 'sample')
      setBusy(true)
      setStatus(
        useLive
          ? 'Preparing the payment on localnet…'
          : `Preparing a sample payment (always ${formatMicroAlgos(PAYMENT_FIXTURE_AMOUNT_MICROALGOS)} ALGO — localnet is offline)…`,
      )
      void startPaymentFlow({
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
    [busy, flow, live, newId, remoteHost, sampleHost, store],
  )

  const decide = useCallback(
    (decision: 'approve' | 'deny') => {
      if (busy || !flow || flow.stage !== 'awaiting-approval') return
      const host: PaymentFlowHost = flowMode === 'live' ? remoteHost : sampleHost
      setBusy(true)
      void performLivePaymentStep({ host, store, flow, kind: decision, newId }).then((outcome) => {
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
        setStatus(flowMode === 'live' ? 'Approved' : 'Approved · finishing the sample…')
        void completeApprovedPaymentFlow({
          host,
          store: outcome.store,
          flow: outcome.flow,
          newId,
          onStep: (nextStore, nextFlow) => {
            setStore(nextStore)
            setFlow(nextFlow)
          },
        }).then((run) => {
          setBusy(false)
          setStore(run.store)
          if (run.flow) setFlow(run.flow)
          if (!run.ok) {
            setStatus(`Approved, but completion failed — ${run.message}`)
            return
          }
          setStatus(
            run.pausedForSigner
              ? 'Approved — signing lands with wallet integration'
              : 'Payment confirmed on-chain',
          )
        })
      })
    },
    [busy, flow, flowMode, newId, remoteHost, sampleHost, store],
  )

  const openAccount = useCallback(
    (address: string) => {
      if (busy) return
      const host: AccountLookupHost = live === true ? remoteHost : sampleHost
      setBusy(true)
      setStatus(`Looking up ${address.slice(0, 8)}…`)
      void host
        .lookupAccount(address)
        .then((record) => {
          setBusy(false)
          setStore((current) => addResult(current, record))
          setArtifact(createAccountOpenView(record))
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
    [busy, live, remoteHost, sampleHost],
  )

  const submit = (raw: string) => {
    const outcome = routeComposerInput(raw)
    setInput('')
    if (outcome.status === 'payment') {
      startPayment(outcome.amountMicroAlgos)
    } else if (outcome.status === 'account') {
      openAccount(outcome.address)
    } else if (outcome.status === 'resolved') {
      setArtifact(outcome.artifact)
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

  const activeViewKind = artifact?.view.view
  const viewModel =
    artifact && activeViewKind === 'transaction.detail'
      ? createTransactionDetailViewModel(store, artifact.view)
      : undefined
  const model = viewModel?.ok ? viewModel.model : undefined
  const accountView =
    artifact && activeViewKind === 'account.portfolio'
      ? createAccountPortfolioViewModel(store, artifact.view)
      : undefined
  const accountModel = accountView?.ok ? accountView.model : undefined
  const flowView = flow ? createPaymentFlowViewModel(store, flow) : undefined
  const flowModel = flowView?.ok ? flowView.model : undefined
  // The browser holds no custody: live signing waits for wallet integration.
  const terminalNote =
    flowMode === 'live' && flowModel?.stage === 'approved' && !busy
      ? 'Approved · signing lands with wallet integration — nothing was signed'
      : flowModel?.stage === 'denied'
        ? 'Nothing was signed'
        : undefined

  const modeLabel =
    live === 'probing' ? 'probing localnet…' : live ? 'live compose-only' : 'sample data'

  return (
    <main className="shell">
      <header className="chrome">
        <div>
          <strong>VIBEKIT EXPLORER</strong>
          <span> · localnet · {modeLabel}</span>
        </div>
        <div className="signer">signer: none</div>
      </header>
      <nav className="tabs">
        <span className="active">{flow ? 'Payment' : (artifact?.title ?? 'Explorer')}</span>
        {flow && artifact ? <span>{artifact.title} · in background</span> : null}
      </nav>
      <div className="body">
        <aside className="sidebar">
          <p className="kicker">NAVIGATION</p>
          <span className="nav-item nav-active">Explorer</span>
          <button className="nav-button" onClick={() => setAccountsOpen(true)}>
            Accounts
          </button>
          <span className="nav-item nav-soon">Assets · soon</span>
          <span className="nav-item nav-soon">Apps · soon</span>
          <span className="nav-item nav-soon">Blocks · soon</span>
          <p className="kicker sidebar-gap">WRITE</p>
          <button onClick={() => startPayment()} disabled={flow !== null || busy}>
            Send payment
          </button>
        </aside>
        {accountsOpen && !flowView ? (
          <AccountsLanding
            accounts={FIXTURE_ADDRESS_BOOK}
            note="Wallet accounts arrive with wallet integration — these are the sample accounts."
            onOpen={openAccount}
          />
        ) : flowView ? (
          <PaymentFlow
            model={flowModel}
            errorMessage={flowView.ok ? undefined : flowView.error.message}
            canSign={flowMode === 'sample'}
            terminalNote={terminalNote}
            busy={busy}
            onApprove={() => decide('approve')}
            onDeny={() => decide('deny')}
            onClose={() => {
              setFlow(null)
              setStatus('Payment panel closed')
            }}
          />
        ) : activeViewKind === 'account.portfolio' ? (
          <AccountView model={accountModel} />
        ) : (
          <Detail
            model={model}
            onOpenSample={() => submit(FIXTURE_TRANSACTION_ID)}
            onOpenAccount={openAccount}
          />
        )}
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
            placeholder="Transaction ID, address, or `pay [algos]`"
            aria-label="Explorer composer"
          />
          <button type="submit">Open</button>
        </form>
        <div className="status-line" role="status" aria-live="polite">
          {status}
        </div>
      </footer>
    </main>
  )
}
