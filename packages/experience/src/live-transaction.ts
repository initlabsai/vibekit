import { z } from 'zod'

import { uint64JsonSchema } from './algo.js'
import { algorandAddressCandidateSchema, algorandTransactionIdSchema } from './classifier.js'
import { openWorkspaceCommandSchema, type WorkspaceCommand } from './protocol.js'
import { structuredResultSchema, type StructuredResult } from './results.js'
import { transactionDetailDataSchema } from './transactions.js'
import { EXPERIENCE_PROTOCOL_VERSION } from './version.js'
import type { ResultIdentity } from './live-payment.js'

/** The JSON-safe wire subset of lookup_transaction this slice consumes. */
export const transactionWireSchema = z.object({
  id: algorandTransactionIdSchema,
  type: z.string().min(1).optional(),
  sender: algorandAddressCandidateSchema,
  fee: z.number().finite().nonnegative().describe('ALGO float on the tool wire'),
  confirmedRound: z.number().int().nonnegative().optional(),
  roundTime: z.number().int().nonnegative().optional(),
  paymentAmount: z.number().finite().nonnegative().optional(),
  receiver: algorandAddressCandidateSchema.optional(),
  assetId: z.number().int().nonnegative().optional(),
  assetAmount: uint64JsonSchema.optional(),
  applicationId: z.number().int().nonnegative().optional(),
})

/**
 * Wraps a lookup_transaction result as a transaction detail record. The tool
 * wire carries ALGO floats; converted back to microALGOs here (same
 * freeze-review follow-up as accounts: tools should expose microALGOs).
 */
export function buildTransactionDetailRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_transaction',
): StructuredResult {
  const txn = transactionWireSchema.parse(wire)
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName,
    network: identity.network,
    data: transactionDetailDataSchema.parse({
      id: txn.id,
      type: txn.type ?? 'txn',
      status: txn.confirmedRound === undefined ? 'pending' : 'confirmed',
      sender: txn.sender,
      feeMicroAlgos: Math.round(txn.fee * 1_000_000),
      ...(txn.receiver === undefined ? {} : { receiver: txn.receiver }),
      ...(txn.paymentAmount === undefined
        ? {}
        : { paymentAmountMicroAlgos: Math.round(txn.paymentAmount * 1_000_000) }),
      ...(txn.confirmedRound === undefined ? {} : { confirmedRound: txn.confirmedRound }),
      ...(txn.roundTime === undefined ? {} : { roundTime: txn.roundTime }),
      ...(txn.assetId === undefined ? {} : { assetId: txn.assetId }),
      ...(txn.assetAmount === undefined ? {} : { assetAmount: txn.assetAmount }),
      ...(txn.applicationId === undefined ? {} : { applicationId: txn.applicationId }),
      relatedEntities: [
        { relation: 'sender', label: 'Sender', entity: 'account', path: ['sender'] },
        ...(txn.receiver === undefined
          ? []
          : [
              {
                relation: 'receiver',
                label: 'Receiver',
                entity: 'account',
                path: ['receiver'],
              } as const,
            ]),
        ...(txn.confirmedRound === undefined
          ? []
          : [
              {
                relation: 'confirmed-round',
                label: 'Confirmed round',
                entity: 'block',
                path: ['confirmedRound'],
              } as const,
            ]),
      ],
    }),
  })
}

/** The capability of looking a transaction up as an authoritative record. */
export interface TransactionLookupHost {
  lookupTransaction(txid: string): Promise<StructuredResult>
}

/** Builds the workspace command that opens a transaction record as a tab. */
export function createTransactionOpenCommand(record: StructuredResult): WorkspaceCommand {
  if (record.state !== 'success') {
    throw new Error('Cannot open a failed transaction record')
  }
  const data = transactionDetailDataSchema.parse(record.data)
  return openWorkspaceCommandSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'workspace.command',
    command: 'open',
    artifactId: `artifact-transaction-${data.id}`,
    title: `Transaction ${data.id.slice(0, 6)}…${data.id.slice(-4)}`,
    view: {
      protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
      type: 'view',
      view: 'transaction.detail',
      source: { source: 'result', id: record.resultId },
    },
    activate: true,
  })
}
