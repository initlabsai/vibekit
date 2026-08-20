import {
  lookupFixture,
  parsePaymentComposerCommand,
  type FixtureLookupOutcome,
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
