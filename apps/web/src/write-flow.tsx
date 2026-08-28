/** The write flow as the browser shows it: the stage rail, the authoritative facts, approve or deny. */
import { formatMicroAlgos, type WriteFlowViewModel } from '@initlabs/vibekit-explorer'

import { Button, Copyable, Fact, Facts, FooterNote, Frame, Header, Hero } from './primitives'
import { shorten } from './theme'

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
      <Frame>
        <Header kicker="PAYMENT" pill="UNAVAILABLE" tone="bad" />
        <p className="muted">{errorMessage ?? 'The flow references no known result.'}</p>
        <div className="actions">
          <Button label="close" onPress={onClose} />
        </div>
      </Frame>
    )
  }

  const currentIndex = FLOW_STEPS.findIndex((step) => step.stages.includes(model.stage))
  const awaiting = model.stage === 'awaiting-approval'
  const failed = model.simulation?.wouldSucceed === false
  const denied = model.stage === 'denied'
  const badge = busy ? 'working…' : awaiting ? 'awaiting approval' : model.stage.replace('-', ' ')
  const tone = failed || denied ? 'danger' : model.stage === 'confirmed' ? 'ok' : awaiting ? 'warn' : 'idle'
  return (
    <Frame tone={failed || denied ? 'danger' : undefined}>
      <Header kicker="PAYMENT" chip={model.network} pill={badge} tone={tone} />
      <Hero
        value={model.amountMicroAlgos === undefined ? model.unsignedGroup.summary : formatMicroAlgos(model.amountMicroAlgos)}
        unit={model.amountMicroAlgos === undefined ? undefined : 'ALGO'}
      />
      <ol className="flow-steps">
        {FLOW_STEPS.map((step, index) => (
          <li
            key={step.label}
            className={index < currentIndex ? 'done' : index === currentIndex ? 'current' : undefined}
          >
            {step.label}
          </li>
        ))}
      </ol>
      <Facts>
        <Fact label="sender" value={model.sender} copy={model.sender} />
        {model.receiver ? <Fact label="receiver" value={model.receiver} copy={model.receiver} /> : null}
        {model.note ? <Fact label="note" value={model.note} /> : null}
        <Fact label="group">
          {model.unsignedGroup.size} transaction{model.unsignedGroup.size === 1 ? '' : 's'} ·{' '}
          <Copyable value={model.unsignedGroup.transactions[0]!} width={32} />
          <span className="line muted">{model.unsignedGroup.summary}</span>
        </Fact>
        {model.simulation ? (
          <>
            <Fact
              label="simulation"
              tone={model.simulation.wouldSucceed ? 'ok' : 'danger'}
              value={[
                model.simulation.wouldSucceed ? 'would succeed' : 'would fail',
                model.simulation.simulatedRound === undefined ? '' : `round ${model.simulation.simulatedRound}`,
                model.simulation.failureMessage ? shorten(model.simulation.failureMessage, 140) : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            />
            <Fact label="fee" value={`${formatMicroAlgos(model.simulation.feeMicroAlgos)} ALGO`} />
            <Fact label="types" value={`${model.simulation.groupSize} × ${model.simulation.transactionTypes.join(', ')}`} />
            <Fact label="effects">
              {model.simulation.effects.map((effect) => {
                const delta = formatMicroAlgos(effect.deltaMicroAlgos)
                const signed = delta.startsWith('-') || delta === '0' ? delta : `+${delta}`
                return (
                  <span key={effect.account} className="line">
                    {effect.role} {signed} ALGO · <Copyable value={effect.account} width={20} />
                  </span>
                )
              })}
            </Fact>
          </>
        ) : null}
        {model.approval ? (
          <Fact
            label="approval"
            value={`${model.approval.state} · ${model.approval.requestId}${model.approval.reason ? ` · ${model.approval.reason}` : ''}`}
          />
        ) : null}
        {model.signed ? (
          <Fact label="signed">
            by <Copyable value={model.signed.signer} width={20} /> · txid{' '}
            <Copyable value={model.signed.txIds[0]!} width={20} />
          </Fact>
        ) : null}
        {model.confirmation ? (
          <Fact label="confirmed" tone="ok">
            round {model.confirmation.confirmedRound} · <Copyable value={model.confirmation.transactionId} width={20} />
          </Fact>
        ) : null}
      </Facts>
      {failed ? (
        <p className="flow-warning">
          Simulation failed — the chain will reject this payment if it is signed and submitted.
        </p>
      ) : null}
      {terminalNote ? <FooterNote text={terminalNote} /> : null}
      <div className="actions">
        {awaiting ? (
          <>
            <Button
              variant="primary"
              disabled={busy}
              onPress={onApprove}
              label={failed ? 'approve anyway' : canSign ? 'approve & send' : 'approve'}
            />
            <Button variant="danger" disabled={busy} onPress={onDeny} label="deny" />
          </>
        ) : busy ? null : (
          <Button label="close" onPress={onClose} />
        )}
      </div>
    </Frame>
  )
}
