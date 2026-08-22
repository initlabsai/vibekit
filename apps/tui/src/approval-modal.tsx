import type { PaymentFlowViewModel } from '@initlabs/vibekit-experience'
import type { LiveNetworkId } from '@initlabs/vibekit-experience/live'

import { PaymentBody } from './cards/index.js'
import { computeGraphLayout } from './cards/transaction-graph-layout.js'
import { COLORS } from './theme.js'
import { Header } from './ui.js'

/**
 * The write decision as a true modal: centered over the app, it owns all
 * input until answered. The graph and facts come from the decoded draft
 * bytes — the same record the signer will be handed, never the model's
 * narration.
 */
export function ApprovalModal({
  model,
  network,
  screenWidth,
  screenHeight,
}: {
  model: PaymentFlowViewModel | undefined
  network: LiveNetworkId
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
      borderColor={failed || network === 'mainnet' ? COLORS.red : COLORS.brass}
      title={` SIGN ▸ ${network.toUpperCase()} `}
      titleColor={network === 'mainnet' ? COLORS.red : COLORS.brassBright}
      bottomTitle={` ${keys} `}
      bottomTitleAlignment="right"
      titleAlignment="left"
      backgroundColor={COLORS.panelRaised}
      paddingX={2}
      paddingY={0}
    >
      <Header
        kicker={payment ? 'APPROVE THIS PAYMENT?' : 'APPROVE THIS GROUP?'}
        pill={failed ? 'WOULD FAIL' : 'SIMULATED OK'}
        tone={failed ? 'bad' : 'ok'}
      />
      {model ? (
        <>
          {layout ? (
            <box flexDirection="column" marginTop={1}>
              {layout.lines.map((line, index) => (
                <box key={index} flexDirection="row" height={1}>
                  {line.map((span, spanIndex) => (
                    <text key={spanIndex} fg={span.fg} content={span.text} />
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
    </box>
  )
}
