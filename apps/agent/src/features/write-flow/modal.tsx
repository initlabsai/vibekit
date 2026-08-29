'use client'

/**
 * The write decision as a true modal: centered over the feed, it owns input
 * until answered. A payment shows what matters — amount, from, to, fee — from
 * the decoded draft bytes, the same record the signer is handed; app calls
 * and groups keep their flow graph and summary. Red frame when the simulation
 * failed or the network is mainnet: money on the line, right now.
 */
import {
  formatBaseUnits,
  formatMicroAlgos,
  type LiveNetworkId,
  type WriteFlowViewModel,
} from '@initlabs/vibekit-explorer'
import { useEffect, useRef } from 'react'

import { Button, Fact, Facts, Header, Hero } from '../../primitives'
import { writeKind } from './cards'
import { TransactionsGraphView } from './graph'

/** A swap says what it is: in → out, the floor after slippage, the venues. The group is one fact below. */
function SwapSummary({
  model,
  swap,
}: {
  model: WriteFlowViewModel
  swap: Extract<NonNullable<WriteFlowViewModel['intent']>, { kind: 'swap' }>
}) {
  const inAmount = `${formatBaseUnits(swap.amountIn, swap.fromDecimals)} ${swap.fromUnit}`
  const out = (base: string) => `${formatBaseUnits(base, swap.toDecimals)} ${swap.toUnit}`
  return (
    <>
      <Hero value={`${inAmount} → ${out(swap.amountOut)}`} />
      <Facts>
        <Fact
          label="at least"
          value={`${out(swap.minAmountOut)} · ${swap.slippagePercent}% slippage`}
        />
        {swap.priceImpactPercent === undefined ? null : (
          <Fact
            label="price impact"
            tone={swap.priceImpactPercent > 1 ? 'danger' : undefined}
            value={`${swap.priceImpactPercent.toFixed(2)}%`}
          />
        )}
        {swap.usdIn !== undefined && swap.usdOut !== undefined ? (
          <Fact label="usd" value={`$${swap.usdIn.toFixed(2)} → $${swap.usdOut.toFixed(2)}`} />
        ) : null}
        <Fact
          label="route"
          value={swap.route.map((leg) => `${leg.venue} ${Math.round(leg.percentage)}%`).join(' · ')}
        />
        <Fact label="from" value={model.sender} copy={model.sender} open={false} />
        {model.simulation ? (
          <Fact label="fee" value={`${formatMicroAlgos(model.simulation.feeMicroAlgos)} ALGO`} />
        ) : null}
        <Fact
          label="group"
          value={`${model.unsignedGroup.size} transactions${model.presignedIndexes?.length ? `, ${model.presignedIndexes.length} signed by the router` : ''}`}
        />
        {model.simulation?.failureMessage ? (
          <Fact label="would fail" tone="danger" value={model.simulation.failureMessage} />
        ) : null}
      </Facts>
    </>
  )
}

function Summary({ model }: { model: WriteFlowViewModel }) {
  const kind = writeKind(model)
  const payment = kind === 'PAYMENT' && model.amountMicroAlgos !== undefined
  if (model.intent?.kind === 'swap') return <SwapSummary model={model} swap={model.intent} />
  return (
    <>
      {payment ? (
        <Hero value={formatMicroAlgos(model.amountMicroAlgos!)} unit="ALGO" />
      ) : (
        <>
          <Hero value={model.unsignedGroup.summary} />
          {model.graph ? <TransactionsGraphView graph={model.graph} /> : null}
        </>
      )}
      <Facts>
        <Fact label="from" value={model.sender} copy={model.sender} open={false} />
        {model.receiver ? (
          <Fact label="to" value={model.receiver} copy={model.receiver} open={false} />
        ) : null}
        {model.note ? <Fact label="note" value={model.note} /> : null}
        {model.simulation ? (
          <Fact label="fee" value={`${formatMicroAlgos(model.simulation.feeMicroAlgos)} ALGO`} />
        ) : null}
        {!payment && model.unsignedGroup.size > 1 ? (
          <Fact label="group" value={`${model.unsignedGroup.size} transactions`} />
        ) : null}
        {model.simulation?.failureMessage ? (
          <Fact label="would fail" tone="danger" value={model.simulation.failureMessage} />
        ) : null}
      </Facts>
    </>
  )
}

export function ApprovalModal({
  model,
  network,
  busy,
  onApprove,
  onDeny,
}: {
  model: WriteFlowViewModel | undefined
  network: LiveNetworkId
  busy: boolean
  onApprove: () => void
  onDeny: () => void
}) {
  const failed = model?.simulation?.wouldSucceed === false
  const danger = failed || network === 'mainnet'
  const approveRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    approveRef.current?.focus()
  }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (busy) return
      if (event.key === 'Escape') onDeny()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onDeny])
  const question = model ? `APPROVE THIS ${writeKind(model)}?` : 'APPROVE?'
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className={`modal${danger ? ' modal-danger' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={question}
      >
        <p className="modal-title">
          SIGN ▸ <span className={`net-${network}`}>{network.toUpperCase()}</span>
        </p>
        <Header
          kicker={question}
          pill={failed ? 'WOULD FAIL' : 'SIMULATED OK'}
          tone={failed ? 'danger' : 'ok'}
        />
        {model ? (
          <Summary model={model} />
        ) : (
          <p className="muted">The write record could not be derived.</p>
        )}
        <p className="footnote">Decoded from the bytes your wallet will sign.</p>
        <div className="actions modal-actions">
          <button
            ref={approveRef}
            type="button"
            className={`button ${danger ? 'button-danger' : 'button-primary'}`}
            disabled={busy || !model}
            onClick={onApprove}
          >
            {busy ? 'working…' : failed ? 'approve anyway' : 'approve & sign'}
          </button>
          <Button label="deny" disabled={busy} onPress={onDeny} />
          <span className="footnote modal-keys">enter approve · esc deny</span>
        </div>
      </div>
    </div>
  )
}
