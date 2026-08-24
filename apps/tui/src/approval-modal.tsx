import type { PaymentFlowViewModel } from '@initlabs/vibekit-explorer'
import type { LiveNetworkId } from '@initlabs/vibekit-explorer/live'

import { PaymentBody } from './cards/index.js'
import { computeGraphLayout } from './cards/transaction-graph-layout.js'
import { breath, COLORS } from './theme.js'
import { GraphSpanText, Header, usePulse } from './ui.js'

const AMBER_BREATH = breath(COLORS.brass, COLORS.brassBright, 5)
const RED_BREATH = breath(COLORS.redDim, COLORS.red, 5)

/** A yes/no gate with a few lines of context — the cost of an expensive tool call. */
export function ConfirmModal({
  title,
  kicker,
  lines,
  screenWidth,
  screenHeight,
}: {
  title: string
  kicker: string
  lines: string[]
  screenWidth: number
  screenHeight: number
}) {
  const width = Math.min(72, Math.max(44, screenWidth - 6))
  const height = Math.min(screenHeight - 2, 5 + lines.length)
  const left = Math.max(0, Math.floor((screenWidth - width) / 2))
  const top = Math.max(0, Math.floor((screenHeight - height) / 2))
  return (
    <box
      position="absolute"
      left={left}
      top={top}
      width={width}
      zIndex={100}
      flexDirection="column"
      border
      borderStyle="double"
      borderColor={COLORS.brass}
      title={` ${title} `}
      titleColor={COLORS.brassBright}
      bottomTitle=" [enter] run · [esc] skip "
      bottomTitleAlignment="right"
      titleAlignment="left"
      backgroundColor={COLORS.surface}
      paddingX={2}
      paddingY={0}
    >
      <Header kicker={kicker} pill="COSTS TOKENS" tone="warn" />
      <box flexDirection="column" marginTop={1}>
        {lines.map((line, index) => (
          <text key={index} fg={index === 0 ? COLORS.text : COLORS.muted} content={line} />
        ))}
      </box>
    </box>
  )
}

/**
 * The write decision as a true modal: centered over the app, it owns all
 * input until answered. The graph and facts come from the decoded draft
 * bytes — the same record the signer will be handed, never the model's
 * narration.
 */
export function ApprovalModal({
  model,
  network,
  origin,
  screenWidth,
  screenHeight,
}: {
  model: PaymentFlowViewModel | undefined
  network: LiveNetworkId
  /** Agent-composed groups carry the hallucination warning; typed ones do not. */
  origin: 'agent' | 'typed'
  screenWidth: number
  screenHeight: number
}) {
  const width = Math.min(76, Math.max(44, screenWidth - 6))
  const failed = model?.simulation?.wouldSucceed === false
  const keys = failed
    ? '[enter] approve anyway · [esc] deny'
    : '[enter] approve & send · [esc] deny'
  const body = Math.max(8, width - 6)
  const layout = model?.graph ? computeGraphLayout(model.graph, body) : undefined
  const graphLines = layout?.lines.length ?? 0
  const effectCount = model?.simulation?.effects.length ?? 0
  const height = Math.min(
    screenHeight - 2,
    11 + graphLines + effectCount + (model?.note ? 1 : 0) + (model?.amountMicroAlgos === undefined ? 1 : 3),
  )
  const left = Math.max(0, Math.floor((screenWidth - width) / 2))
  const top = Math.max(0, Math.floor((screenHeight - height) / 2))
  const payment = model?.amountMicroAlgos !== undefined
  const types = model?.simulation?.transactionTypes
  const kicker = payment
    ? 'APPROVE THIS PAYMENT?'
    : model?.unsignedGroup.summary.startsWith('create app')
      ? 'APPROVE THIS DEPLOY?'
      : types?.length === 1 && types[0] === 'appl'
        ? 'APPROVE THIS CALL?'
        : 'APPROVE THIS GROUP?'
  // The one moment the UI waits on a human: the frame breathes until you answer.
  const danger = failed || network === 'mainnet'
  const phase = usePulse(2400, AMBER_BREATH.length)
  const borderColor = (danger ? RED_BREATH : AMBER_BREATH)[phase]!
  return (
    <box
      position="absolute"
      left={left}
      top={top}
      width={width}
      zIndex={100}
      flexDirection="column"
      border
      borderStyle="double"
      borderColor={borderColor}
      title={` SIGN ▸ ${network.toUpperCase()} `}
      titleColor={network === 'mainnet' ? COLORS.red : COLORS.brassBright}
      bottomTitle={` ${keys} `}
      bottomTitleAlignment="right"
      titleAlignment="left"
      backgroundColor={COLORS.surface}
      paddingX={2}
      paddingY={0}
    >
      <Header
        kicker={kicker}
        pill={failed ? 'WOULD FAIL' : 'SIMULATED OK'}
        tone={failed ? 'danger' : 'ok'}
      />
      {model ? (
        <>
          {layout ? (
            <box flexDirection="column" marginTop={1}>
              {layout.lines.map((line, index) => (
                <box key={index} flexDirection="row" height={1}>
                  {line.map((span, spanIndex) => (
                    <GraphSpanText key={spanIndex} text={span.text} fg={span.fg} copy={span.copy} />
                  ))}
                </box>
              ))}
            </box>
          ) : null}
          <PaymentBody model={model} width={body} big />
        </>
      ) : (
        <text fg={COLORS.muted} marginTop={1} content="The write record could not be derived." />
      )}
      {failed ? (
        <text fg={COLORS.red} marginTop={1} content="This group WOULD FAIL if submitted." />
      ) : null}
      <text
        fg={COLORS.faint}
        marginTop={1}
        content={
          origin === 'agent'
            ? 'AI-composed — check every field yourself. Smaller models hallucinate; prefer a large frontier model.'
            : 'Composed from what you typed — these decoded bytes are exactly what gets signed.'
        }
      />
    </box>
  )
}
