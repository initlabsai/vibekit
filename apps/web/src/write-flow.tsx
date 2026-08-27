/** The write flow as the browser shows it: the stage rail, the authoritative facts, approve or deny. */
import { formatMicroAlgos, type WriteFlowViewModel } from '@initlabs/vibekit-explorer'

import { shorten } from './views'

const FLOW_STEPS: Array<{ label: string; stages: WriteFlowViewModel['stage'][] }> = [
  { label: 'Draft', stages: ['drafted'] },
  { label: 'Simulate', stages: ['simulated'] },
  { label: 'Inspect', stages: ['inspected'] },
  { label: 'Approval', stages: ['awaiting-approval', 'approved', 'denied'] },
  { label: 'Sign', stages: ['signed'] },
  { label: 'Confirm', stages: ['confirmed'] },
]

export function WriteFlowView({
  model,
  errorMessage,
  canSign,
  terminalNote,
  busy,
  onApprove,
  onDeny,
  onClose,
}: {
  model: WriteFlowViewModel | undefined
  errorMessage: string | undefined
  /** The host can sign after approval (the sample host); the live browser host cannot. */
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
      {failed ? (
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
