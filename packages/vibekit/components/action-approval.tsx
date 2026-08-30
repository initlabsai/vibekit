/**
 * The decision an action needs: what the group does, from the decoded draft
 * bytes (the same record the signer is handed), the simulation's verdict, and
 * two buttons. A swap or an order says what it is; a payment shows amount,
 * from, to; anything else shows its summary and the group. Wrap it in your
 * own modal, or render it inline.
 */
import type { WriteDraftData, WriteSimulationData } from '@initlabs/vibekit/actions'

import { formatBaseUnits, formatMicroAlgos, shorten } from './format'

export type ActionApprovalProps = {
  draft: WriteDraftData
  simulation?: WriteSimulationData
  network: string
  onApprove: () => void
  onDeny: () => void
  /** While the decision is being carried out. */
  busy?: boolean
  className?: string
}

function headline(draft: WriteDraftData): string {
  const intent = draft.intent
  if (intent?.kind === 'swap') {
    return `${formatBaseUnits(intent.amountIn, intent.fromDecimals)} ${intent.fromUnit} → ${formatBaseUnits(intent.amountOut, intent.toDecimals)} ${intent.toUnit}`
  }
  if (intent?.kind === 'order') {
    return `${intent.action} ${intent.quantity} ${intent.side.toUpperCase()} @ $${intent.priceUsd.toFixed(2)}`
  }
  if (draft.amountMicroAlgos !== undefined) return `${formatMicroAlgos(draft.amountMicroAlgos)} ALGO`
  return draft.unsignedGroup.summary
}

export function ActionApproval({ draft, simulation, network, onApprove, onDeny, busy = false, className = '' }: ActionApprovalProps) {
  const failed = simulation ? !simulation.wouldSucceed : false
  const presigned = draft.presigned?.filter((leg) => leg !== null).length ?? 0
  const facts: Array<[string, string | undefined]> = [
    ['from', draft.sender],
    ['to', draft.receiver],
    ['fee', `${formatMicroAlgos(simulation?.feeMicroAlgos ?? draft.feeMicroAlgos)} ALGO`],
    ['network', network],
    ['group', draft.unsignedGroup.transactions.length === 1 ? undefined : `${draft.unsignedGroup.transactions.length} transactions${presigned ? `, ${presigned} pre-signed` : ''}`],
    ['note', draft.note],
  ]
  if (draft.intent?.kind === 'swap') {
    facts.splice(2, 0, ['at least', `${formatBaseUnits(draft.intent.minAmountOut, draft.intent.toDecimals)} ${draft.intent.toUnit} · ${draft.intent.slippagePercent}% slippage`])
  }
  return (
    <section className={`vk-card vk-approval${failed || network === 'mainnet' ? ' vk-approval-danger' : ''} ${className}`} role="dialog" aria-labelledby="vk-approval-title">
      <header className="vk-kicker">{failed ? 'would fail' : simulation ? 'simulated ok' : 'review'}</header>
      <h3 className="vk-hero" id="vk-approval-title">{headline(draft)}</h3>
      <p className="vk-summary">{draft.unsignedGroup.summary}</p>
      <dl className="vk-facts">
        {facts.map(([label, value]) =>
          value === undefined ? null : (
            <div key={label}>
              <dt>{label}</dt>
              <dd title={value}>{/^[A-Z2-7]{58}$/.test(value) ? shorten(value) : value}</dd>
            </div>
          ),
        )}
      </dl>
      {failed && simulation?.failureMessage ? <p className="vk-error">{simulation.failureMessage}</p> : null}
      <footer className="vk-actions">
        <button type="button" className="vk-button" onClick={onDeny} disabled={busy}>
          deny
        </button>
        <button type="button" className="vk-button vk-button-primary" onClick={onApprove} disabled={busy || failed}>
          {busy ? 'working…' : 'approve'}
        </button>
      </footer>
    </section>
  )
}
