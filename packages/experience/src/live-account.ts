import { z } from 'zod'

import { accountPortfolioDataSchema } from './accounts.js'
import { algorandAddressCandidateSchema } from './classifier.js'
import { openWorkspaceCommandSchema, type WorkspaceCommand } from './protocol.js'
import { structuredResultSchema, type StructuredResult } from './results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from './version.js'
import type { ResultIdentity } from './live-payment.js'

/** The JSON-safe wire subset of get_account_portfolio this slice consumes. */
export const accountPortfolioWireSchema = z.object({
  address: algorandAddressCandidateSchema,
  algoBalance: z.number().finite().nonnegative(),
  totalAssets: z.number().int().nonnegative(),
  assets: z.array(
    z.object({
      assetId: z.number().int().nonnegative(),
      amount: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]),
      isFrozen: z.boolean(),
      name: z.string().min(1).optional(),
      unitName: z.string().min(1).optional(),
    }),
  ),
})

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

/**
 * Wraps a get_account_portfolio result as a portfolio record. The tool wire
 * carries the balance as an ALGO float; it is converted back to microALGOs
 * here. Freeze-review follow-up: the account tools should expose microALGOs
 * so this conversion disappears.
 */
export function buildAccountPortfolioRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'get_account_portfolio',
): StructuredResult {
  const portfolio = accountPortfolioWireSchema.parse(wire)
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName,
    network: identity.network,
    data: accountPortfolioDataSchema.parse({
      address: portfolio.address,
      balanceMicroAlgos: Math.round(portfolio.algoBalance * 1_000_000),
      totalAssets: portfolio.totalAssets,
      assets: portfolio.assets.map((asset) => ({
        assetId: asset.assetId,
        amount: asset.amount,
        isFrozen: asset.isFrozen,
        ...(asset.name === undefined ? {} : { name: asset.name }),
        ...(asset.unitName === undefined ? {} : { unitName: asset.unitName }),
      })),
    }),
  })
}

/** Builds the workspace command that opens a portfolio record as a tab. */
export function createAccountOpenCommand(record: StructuredResult): WorkspaceCommand {
  if (record.state !== 'success') {
    throw new Error('Cannot open a failed account record')
  }
  const data = accountPortfolioDataSchema.parse(record.data)
  const address = data.address
  return openWorkspaceCommandSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'workspace.command',
    command: 'open',
    artifactId: `artifact-account-${address}`,
    title: `Account ${address.slice(0, 6)}…${address.slice(-4)}`,
    view: {
      protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
      type: 'view',
      view: 'account.portfolio',
      source: { source: 'result', id: record.resultId },
    },
    activate: true,
  })
}
