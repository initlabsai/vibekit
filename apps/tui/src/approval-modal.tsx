import type { PaymentFlowViewModel } from '@initlabs/vibekit-experience'

import { paymentLines } from './cards.js'
import { COLORS, shorten } from './theme.js'

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
  const lines = model ? paymentLines(model) : ['The payment record could not be derived.']
  const failed = model?.simulation?.wouldSucceed === false
  const warning = failed ? ['', 'This payment WOULD FAIL if submitted.'] : []
  const keys = failed
    ? '[enter] approve anyway · [esc] deny'
    : '[enter] approve & send · [esc] deny'
  const height = lines.length + warning.length + 5
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
      <box flexDirection="row" justifyContent="space-between">
        <text fg={COLORS.brassBright}>APPROVE THIS PAYMENT?</text>
        <text fg={failed ? COLORS.red : COLORS.brass}>
          {failed ? 'WOULD FAIL' : 'SIMULATED OK'}
        </text>
      </box>
      <text
        fg={COLORS.text}
        marginTop={1}
        content={[...lines, ...warning].map((line) => shorten(line, width - 6)).join('\n')}
      />
      <text fg={COLORS.brassBright} marginTop={1} content={keys} />
    </box>
  )
}
