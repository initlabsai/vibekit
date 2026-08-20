import { viewDataSchemas } from '@initlabs/vibekit-tools/views'

import { accountPortfolioDataSchema } from './accounts.js'
import type { ExplorerArtifact } from './protocol.js'
import { structuredResultSchema, type StructuredResult } from './results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from './version.js'
import type { ResultIdentity } from './live-payment.js'

/** The capability of looking an account up as an authoritative record. */
export interface AccountLookupHost {
  lookupAccount(address: string): Promise<StructuredResult>
  /** Looks several accounts up as one account.list record. */
  lookupAccounts(addresses: readonly string[]): Promise<StructuredResult>
  /** Lists assets held by an account. */
  lookupAccountAssets(address: string): Promise<StructuredResult>
  /** Lists application local state for apps an account has opted into. */
  lookupAccountAppStates(address: string): Promise<StructuredResult>
  /** Lists transactions involving an account. */
  lookupAccountTransactions(address: string): Promise<StructuredResult>
}

/** Wraps a get_account_portfolio result as a portfolio record. */
export function buildAccountPortfolioRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'get_account_portfolio',
): StructuredResult {
  const portfolio = viewDataSchemas['account.portfolio'].parse(wire)
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName,
    network: identity.network,
    data: accountPortfolioDataSchema.parse(portfolio),
  })
}

/** Builds the titled trusted view that renders a portfolio record. */
export function createAccountArtifact(record: StructuredResult): ExplorerArtifact {
  if (record.state !== 'success') {
    throw new Error('Cannot open a failed account record')
  }
  const data = accountPortfolioDataSchema.parse(record.data)
  const address = data.address
  return {
    title: `Account ${address.slice(0, 6)}…${address.slice(-4)}`,
    view: {
      protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
      type: 'view',
      view: 'account.portfolio',
      source: { source: 'result', id: record.resultId },
    },
  }
}
