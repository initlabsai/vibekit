import {
  formatMicroAlgos,
  type PaymentFlowViewModel,
} from '@initlabs/vibekit-experience'

import { COLORS } from '../theme.js'
import {
  Fact,
  Frame,
  Header,
  Hero,
  innerWidth,
  PartyPath,
  Rule,
  Unavailable,
  type Tone,
} from '../ui.js'
import { algo } from './shared.js'

function signedDelta(value: number | string): string {
  const formatted = formatMicroAlgos(value)
  return formatted.startsWith('-') || formatted === '0' ? formatted : `+${formatted}`
}

/** Flat lines for tests and for hosts that still want a text dump. */
export function paymentLines(model: PaymentFlowViewModel): string[] {
  const lines = [
    model.amountMicroAlgos === undefined
      ? `${model.unsignedGroup.summary} · ${model.network}`
      : `${formatMicroAlgos(model.amountMicroAlgos)} ALGO · ${model.network}`,
    `from  ${model.sender}`,
  ]
  if (model.receiver) lines.push(`to    ${model.receiver}`)
  if (model.simulation) {
    lines.push(
      `${model.simulation.wouldSucceed ? 'would succeed' : 'WOULD FAIL'} · fee ${formatMicroAlgos(model.simulation.feeMicroAlgos)} ALGO${model.simulation.simulatedRound === undefined ? '' : ` · round ${model.simulation.simulatedRound}`}`,
    )
    if (model.simulation.failureMessage) lines.push(`why: ${model.simulation.failureMessage}`)
    for (const effect of model.simulation.effects) {
      lines.push(`  ${effect.role.padEnd(8)} ${signedDelta(effect.deltaMicroAlgos)} ALGO`)
    }
  }
  if (model.approval && model.approval.state !== 'pending') {
    lines.push(
      `approval: ${model.approval.state}${model.approval.reason ? ` · ${model.approval.reason}` : ''}`,
    )
  }
  if (model.signed) lines.push(`signed by keystore · ${model.signed.txIds[0]!}`)
  if (model.confirmation) {
    lines.push(
      `confirmed · round ${model.confirmation.confirmedRound} · ${model.confirmation.transactionId}`,
    )
  }
  return lines
}

export function PaymentBody({
  model,
  width,
}: {
  model: PaymentFlowViewModel
  width: number
}) {
  const failed = model.simulation?.wouldSucceed === false
  return (
    <box flexDirection="column">
      {model.amountMicroAlgos === undefined ? (
        <text fg={COLORS.brassBright} marginTop={1} content={model.unsignedGroup.summary} />
      ) : (
        <Hero value={formatMicroAlgos(model.amountMicroAlgos)} unit="ALGO" />
      )}
      {model.receiver ? <PartyPath from={model.sender} to={model.receiver} width={width} /> : null}
      <box marginTop={1} flexDirection="column">
        <Rule width={width} />
        <Fact label="network" value={model.network} width={width} />
        {model.note ? <Fact label="note" value={model.note} width={width} /> : null}
        {model.simulation ? (
          <Fact
            label="sim"
            value={model.simulation.wouldSucceed ? 'would succeed' : 'WOULD FAIL'}
            width={width}
            valueColor={failed ? COLORS.red : COLORS.green}
          />
        ) : null}
        {model.simulation ? (
          <Fact label="fee" value={algo(model.simulation.feeMicroAlgos) ?? '—'} width={width} />
        ) : null}
        {model.simulation?.simulatedRound === undefined ? null : (
          <Fact
            label="round"
            value={String(model.simulation.simulatedRound)}
            copy={String(model.simulation.simulatedRound)}
            width={width}
          />
        )}
        {model.simulation?.failureMessage ? (
          <Fact
            label="why"
            value={model.simulation.failureMessage}
            width={width}
            valueColor={COLORS.red}
          />
        ) : null}
        {model.simulation
          ? model.simulation.effects.map((effect) => (
              <Fact
                key={`${effect.role}-${effect.account}`}
                label={effect.role}
                value={`${signedDelta(effect.deltaMicroAlgos)} ALGO`}
                width={width}
                valueColor={
                  String(effect.deltaMicroAlgos).startsWith('-') ? COLORS.red : COLORS.green
                }
              />
            ))
          : null}
        {model.approval && model.approval.state !== 'pending' ? (
          <Fact
            label="approval"
            value={`${model.approval.state}${model.approval.reason ? ` · ${model.approval.reason}` : ''}`}
            width={width}
          />
        ) : null}
        {model.signed ? (
          <Fact
            label="signed"
            value={model.signed.txIds[0] ?? ''}
            copy={model.signed.txIds[0]}
            width={width}
          />
        ) : null}
        {model.confirmation ? (
          <Fact
            label="round"
            value={String(model.confirmation.confirmedRound)}
            copy={String(model.confirmation.confirmedRound)}
            width={width}
            valueColor={COLORS.green}
          />
        ) : null}
        {model.confirmation ? (
          <Fact
            label="id"
            value={model.confirmation.transactionId}
            copy={model.confirmation.transactionId}
            width={width}
            valueColor={COLORS.green}
          />
        ) : null}
      </box>
    </box>
  )
}

export function PaymentCard({
  model,
  stage,
  busy,
  width,
}: {
  model: PaymentFlowViewModel | undefined
  stage: string
  busy: boolean
  width: number
}) {
  if (!model) return <Unavailable title="PAYMENT" width={width} />
  const failed = model.simulation?.wouldSucceed === false
  const badge = busy
    ? 'WORKING…'
    : stage === 'awaiting-approval'
      ? failed
        ? 'SIMULATION FAILED'
        : 'AWAITING APPROVAL'
      : stage === 'confirmed'
        ? 'CONFIRMED'
        : stage === 'denied'
          ? 'DENIED'
          : stage.toUpperCase()
  const tone: Tone =
    stage === 'denied' || failed ? 'bad' : stage === 'confirmed' ? 'ok' : 'warn'
  return (
    <Frame width={width} accent={tone === 'bad' ? COLORS.red : tone === 'ok' ? COLORS.green : COLORS.brass}>
      <Header
        kicker={model.amountMicroAlgos === undefined ? 'WRITE' : 'PAYMENT'}
        pill={badge}
        tone={tone}
      />
      <PaymentBody model={model} width={innerWidth(width)} />
    </Frame>
  )
}
