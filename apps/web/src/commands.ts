import {
  EXPERIENCE_PROTOCOL_VERSION,
  focusWorkspaceCommandSchema,
  lookupFixture,
  parsePaymentComposerCommand,
  type FixtureLookupOutcome,
  type WorkspaceCommand,
} from '@initlabs/vibekit-experience'

/** Composer routing outcome: a lookup, a payment, or an account to open. */
export type ComposerRoute =
  | FixtureLookupOutcome
  | { status: 'payment'; amountMicroAlgos: number }
  | { status: 'account'; address: string }

export function routeComposerInput(input: string): ComposerRoute {
  const payment = parsePaymentComposerCommand(input)
  if (payment) return { status: 'payment', ...payment }
  const outcome = lookupFixture(input)
  if (
    outcome.status === 'unresolved' &&
    outcome.classification.kind === 'entity' &&
    outcome.classification.entity === 'account'
  ) {
    return { status: 'account', address: outcome.classification.value }
  }
  return outcome
}

export function createFocusCommand(
  target: 'navigation' | 'composer' | { area: 'workspace'; artifactId?: string },
): WorkspaceCommand {
  return focusWorkspaceCommandSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'workspace.command',
    command: 'focus',
    target: typeof target === 'string' ? { area: target } : target,
  })
}
