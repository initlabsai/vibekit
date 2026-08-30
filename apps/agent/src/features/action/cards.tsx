'use client'

/** The action flow in the feed: the stage rail, the authoritative facts, the graph, and where it ended. */
import { formatMicroAlgos, type ActionViewModel } from '@initlabs/vibekit-explorer'
import type { ReactNode } from 'react'

import {
  Button,
  Copyable,
  Fact,
  Facts,
  FooterNote,
  Frame,
  Header,
  Hero,
  type Tone,
} from '../../primitives'
import { shorten } from '../../theme'
import { TransactionsGraphView } from './graph'

const FLOW_STEPS: Array<{ label: string; stages: ActionViewModel['stage'][] }> = [
  { label: 'Draft', stages: ['drafted'] },
  { label: 'Simulate', stages: ['simulated'] },
  { label: 'Inspect', stages: ['inspected'] },
  { label: 'Approval', stages: ['awaiting-approval', 'approved', 'denied'] },
  { label: 'Sign', stages: ['signed'] },
  { label: 'Confirm', stages: ['confirmed'] },
]

function signedDelta(value: number | string): string {
  const formatted = formatMicroAlgos(value)
  return formatted.startsWith('-') || formatted === '0' ? formatted : `+${formatted}`
}

/** What the group is, in the modal's question and the card's kicker. */
export function writeKind(
  model: ActionViewModel,
): 'PAYMENT' | 'SWAP' | 'ORDER' | 'DEPLOY' | 'CALL' | 'GROUP' {
  if (model.intent?.kind === 'swap') return 'SWAP'
  if (model.intent?.kind === 'order') return 'ORDER'
  if (model.amountMicroAlgos !== undefined) return 'PAYMENT'
  if (model.unsignedGroup.summary.startsWith('create app')) return 'DEPLOY'
  const types = model.simulation?.transactionTypes
  return types?.length === 1 && types[0] === 'appl' ? 'CALL' : 'GROUP'
}

/** The authoritative facts of the group under review: parties, bytes, simulation, effects, and outcome. */
export function ActionBody({ model }: { model: ActionViewModel }) {
  return (
    <Facts>
      <Fact label="from" value={model.sender} copy={model.sender} />
      {model.receiver ? <Fact label="to" value={model.receiver} copy={model.receiver} /> : null}
      {model.note ? <Fact label="note" value={model.note} /> : null}
      <Fact label="group">
        {model.unsignedGroup.size} transaction{model.unsignedGroup.size === 1 ? '' : 's'}
        {model.presignedIndexes?.length
          ? ` · ${model.presignedIndexes.length} signed by the router`
          : ''}{' '}
        · <Copyable value={model.unsignedGroup.transactions[0]!} width={32} />
        <span className="line muted">{model.unsignedGroup.summary}</span>
      </Fact>
      {model.simulation ? (
        <>
          <Fact
            label="simulation"
            tone={model.simulation.wouldSucceed ? 'ok' : 'danger'}
            value={[
              model.simulation.wouldSucceed ? 'would succeed' : 'WOULD FAIL',
              model.simulation.simulatedRound === undefined
                ? ''
                : `round ${model.simulation.simulatedRound}`,
              model.simulation.failureMessage ? shorten(model.simulation.failureMessage, 160) : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          />
          <Fact label="fee" value={`${formatMicroAlgos(model.simulation.feeMicroAlgos)} ALGO`} />
          <Fact label="effects">
            {model.simulation.effects.map((effect) => (
              <span key={effect.account} className="line">
                <span className="muted">{effect.role.padEnd(8)}</span>{' '}
                {signedDelta(effect.deltaMicroAlgos)} ALGO ·{' '}
                <Copyable value={effect.account} width={20} />
              </span>
            ))}
          </Fact>
        </>
      ) : null}
      {model.approval && model.approval.state !== 'pending' ? (
        <Fact
          label="approval"
          value={`${model.approval.state}${model.approval.reason ? ` · ${model.approval.reason}` : ''}`}
        />
      ) : null}
      {model.signed ? (
        <Fact label="signed">
          by <Copyable value={model.signed.signer} width={20} /> ·{' '}
          <Copyable value={model.signed.txIds[0]!} width={20} />
        </Fact>
      ) : null}
      {model.confirmation ? (
        <Fact label="confirmed" tone="ok">
          round {model.confirmation.confirmedRound} ·{' '}
          <Copyable value={model.confirmation.transactionId} width={20} />
        </Fact>
      ) : null}
    </Facts>
  )
}

export function ActionCard({
  model,
  errorMessage,
  network,
  busy,
  onClose,
  action,
}: {
  model: ActionViewModel | undefined
  errorMessage: string | undefined
  network: string
  busy: boolean
  onClose?: () => void
  action?: ReactNode
}) {
  if (!model) {
    return (
      <Frame>
        <Header kicker="WRITE" pill="UNAVAILABLE" tone="bad" />
        <p className="muted">{errorMessage ?? 'The flow references no known result.'}</p>
      </Frame>
    )
  }
  const currentIndex = FLOW_STEPS.findIndex((step) => step.stages.includes(model.stage))
  const failed = model.simulation?.wouldSucceed === false
  const denied = model.stage === 'denied'
  const badge = busy ? 'working…' : model.stage.replace('-', ' ')
  const tone: Tone =
    failed || denied
      ? 'danger'
      : model.stage === 'confirmed'
        ? 'ok'
        : model.stage === 'awaiting-approval'
          ? 'warn'
          : 'idle'
  return (
    <Frame tone={failed || denied || network === 'mainnet' ? 'danger' : undefined}>
      <Header
        kicker={writeKind(model)}
        chip={model.network}
        pill={badge}
        tone={tone}
        action={action}
      />
      <Hero
        value={
          model.amountMicroAlgos === undefined
            ? model.unsignedGroup.summary
            : formatMicroAlgos(model.amountMicroAlgos)
        }
        unit={model.amountMicroAlgos === undefined ? undefined : 'ALGO'}
      />
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
      {model.graph ? <TransactionsGraphView graph={model.graph} /> : null}
      <ActionBody model={model} />
      {failed ? <p className="flow-warning">This group WOULD FAIL if submitted.</p> : null}
      {model.stage === 'approved' && !busy ? (
        <FooterNote text="Approved — nothing was signed." />
      ) : null}
      {onClose && !busy && model.stage !== 'awaiting-approval' ? (
        <div className="actions">
          <Button label="close" onPress={onClose} />
        </div>
      ) : null}
    </Frame>
  )
}
