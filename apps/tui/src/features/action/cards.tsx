import algosdk from 'algosdk'
import { formatMicroAlgos, type ActionViewModel } from '@initlabs/vibekit/views'

import { COLORS } from '../../theme.js'
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
} from '../../primitives.js'
import { algo } from '../../generic-cards.js'

function signedDelta(value: number | string): string {
  const formatted = formatMicroAlgos(value)
  return formatted.startsWith('-') || formatted === '0' ? formatted : `+${formatted}`
}

/** Flat lines for tests and for hosts that still want a text dump. */
export function paymentLines(model: ActionViewModel): string[] {
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

/** `HiWorld.hi(name: "gabe") → app 1018` (describeCall) pulled apart for display; undefined for any other summary. */
export function parseCallSummary(summary: string):
  | {
      call: string
      appId: string
      args: Array<{ name: string; value: string }>
      fundMicroAlgos?: number
    }
  | undefined {
  const match = /^([\w.]+)\((.*)\) → app (\d+)(?: · funds app (\d+) µALGO)?$/s.exec(summary)
  if (!match) return undefined
  const [, call, inner, appId, fund] = match
  const parts: string[] = []
  let current = ''
  let depth = 0
  let quote = false
  for (const ch of inner!) {
    if (ch === '"') quote = !quote
    if (!quote) {
      if ('[{('.includes(ch)) depth += 1
      if (']})'.includes(ch)) depth -= 1
      if (ch === ',' && depth === 0) {
        parts.push(current.trim())
        current = ''
        continue
      }
    }
    current += ch
  }
  if (current.trim()) parts.push(current.trim())
  const args = parts.map((part) => {
    const colon = part.indexOf(': ')
    return colon > 0
      ? { name: part.slice(0, colon), value: part.slice(colon + 2) }
      : { name: '', value: part }
  })
  return { call: call!, appId: appId!, args, ...(fund ? { fundMicroAlgos: Number(fund) } : {}) }
}

/**
 * Turns algod's "account X balance N below min M" into the fix: fund the app
 * account through the line's +fund, or fund the sender. Undefined otherwise.
 */
export function minBalanceHint(failureMessage: string, summary: string): string | undefined {
  const match = /account ([A-Z2-7]{58}) balance (\d+) below min (\d+)/.exec(failureMessage)
  if (!match) return undefined
  const [, account, balance, min] = match
  const short = Number(min) - Number(balance)
  // Round up to the next 0.01 ALGO so one retry is enough.
  const algo = (Math.ceil(short / 10_000) / 100).toFixed(2)
  const parsed = parseCallSummary(summary)
  const appAddress = parsed
    ? algosdk.getApplicationAddress(BigInt(parsed.appId)).toString()
    : undefined
  if (account === appAddress)
    return `the app account is short by ${formatMicroAlgos(short)} ALGO — deny, then retry with +fund ${algo} on the line`
  return `${account.slice(0, 8)}… is short by ${formatMicroAlgos(short)} ALGO — fund it first`
}

/** The call under review: what is called, then each argument on its own line where it cannot be missed. */
function CallSummary({ summary, width }: { summary: string; width: number }) {
  const parsed = parseCallSummary(summary)
  if (!parsed) return <text fg={COLORS.brassBright} marginTop={1} content={summary} />
  return (
    <box flexDirection="column" marginTop={1}>
      <box flexDirection="row" height={1}>
        <text fg={COLORS.brassBright} content={parsed.call} />
        <text fg={COLORS.muted} content={`  → app ${parsed.appId}`} />
      </box>
      {parsed.fundMicroAlgos ? (
        <Fact
          label="funds app"
          value={`${formatMicroAlgos(parsed.fundMicroAlgos)} ALGO`}
          width={width}
          valueColor={COLORS.text}
        />
      ) : null}
      {parsed.args.length === 0 ? (
        <text fg={COLORS.faint} content="no arguments" />
      ) : (
        parsed.args.map((arg, index) => (
          <Fact
            key={`${arg.name}-${index}`}
            label={arg.name || `arg${index}`}
            value={arg.value}
            width={width}
            valueColor={COLORS.text}
          />
        ))
      )}
    </box>
  )
}

export function ActionBody({
  model,
  width,
  big = false,
}: {
  model: ActionViewModel
  width: number
  /** Render the amount as a two-row ascii figure (the approval modal). */
  big?: boolean
}) {
  const failed = model.simulation?.wouldSucceed === false
  return (
    <box flexDirection="column">
      {model.amountMicroAlgos === undefined ? (
        <CallSummary summary={model.unsignedGroup.summary} width={width} />
      ) : big ? (
        <box flexDirection="row" alignItems="flex-end" marginTop={1} height={2}>
          <ascii-font
            font="tiny"
            text={formatMicroAlgos(model.amountMicroAlgos)}
            color={[COLORS.brassBright, COLORS.signal]}
          />
          <text fg={COLORS.muted}>{'  ALGO'}</text>
        </box>
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
            valueColor={failed ? COLORS.red : COLORS.signal}
          />
        ) : null}
        {model.simulation ? (
          <Fact label="fee" value={algo(model.simulation.feeMicroAlgos)} width={width} />
        ) : null}
        {model.simulation?.simulatedRound === undefined ? null : (
          <Fact
            label="sim round"
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
        {model.simulation?.failureMessage
          ? (() => {
              const hint = minBalanceHint(
                model.simulation.failureMessage,
                model.unsignedGroup.summary,
              )
              return hint ? (
                <Fact label="fix" value={hint} width={width} valueColor={COLORS.brassBright} />
              ) : null
            })()
          : null}
        {model.simulation
          ? model.simulation.effects.map((effect) => (
              <Fact
                key={`${effect.role}-${effect.account}`}
                label={effect.role}
                value={`${signedDelta(effect.deltaMicroAlgos)} ALGO`}
                width={width}
                valueColor={
                  String(effect.deltaMicroAlgos).startsWith('-') ? COLORS.brass : COLORS.signal
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
        {model.signed && !model.confirmation ? (
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
            valueColor={COLORS.signal}
          />
        ) : null}
        {model.confirmation ? (
          <Fact
            label="id"
            value={model.confirmation.transactionId}
            copy={model.confirmation.transactionId}
            width={width}
            valueColor={COLORS.signal}
          />
        ) : null}
      </box>
    </box>
  )
}

export function ActionCard({
  model,
  stage,
  busy,
  width,
}: {
  model: ActionViewModel | undefined
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
  const tone: Tone = stage === 'denied' || failed ? 'bad' : stage === 'confirmed' ? 'ok' : 'warn'
  return (
    <Frame width={width}>
      <Header
        kicker={model.amountMicroAlgos === undefined ? 'WRITE' : 'PAYMENT'}
        pill={badge}
        tone={tone}
      />
      <ActionBody model={model} width={innerWidth(width)} />
    </Frame>
  )
}
