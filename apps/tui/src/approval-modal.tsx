import type { PaymentFlowViewModel } from '@initlabs/vibekit-experience'

import { PaymentBody } from './cards/index.js'
import { COLORS } from './theme.js'
import { Header } from './ui.js'

/**
 * The payment decision as a true modal: centered over the app, it owns all
 * input until answered. The facts shown come from the decoded draft bytes —
 * the same record the signer will be handed, never the model's narration.
 */
export function ApprovalModal({
  model,
  screenWidth,
  screenHeight,
}: {
  model: PaymentFlowViewModel | undefined
  screenWidth: number
  screenHeight: number
}) {
  const width = Math.min(76, Math.max(44, screenWidth - 6))
  const failed = model?.simulation?.wouldSucceed === false
  const keys = failed
    ? '[enter] approve anyway · [esc] deny'
    : '[enter] approve & send · [esc] deny'
  const effectCount = model?.simulation?.effects.length ?? 0
  const height = Math.min(screenHeight - 2, 10 + effectCount + (model?.note ? 1 : 0))
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
      borderColor={failed ? COLORS.red : COLORS.brass}
      backgroundColor={COLORS.panelRaised}
      paddingX={2}
      paddingY={0}
    >
      <Header
        kicker="APPROVE THIS PAYMENT?"
        pill={failed ? 'WOULD FAIL' : 'SIMULATED OK'}
        tone={failed ? 'bad' : 'ok'}
      />
      {model ? (
        <PaymentBody model={model} width={Math.max(8, width - 6)} />
      ) : (
        <text fg={COLORS.muted} marginTop={1} content="The payment record could not be derived." />
      )}
      {failed ? (
        <text fg={COLORS.red} marginTop={1} content="This payment WOULD FAIL if submitted." />
      ) : null}
      <text fg={COLORS.brassBright} marginTop={1} content={keys} />
    </box>
  )
}
