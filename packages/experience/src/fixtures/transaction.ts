import { classifyExplorerInput, type ClassifiedExplorerInput } from '../classifier.js'
import {
  transactionDetailViewSpecSchema,
  type ExplorerArtifact,
  type ViewSpec,
} from '../protocol.js'
import { createResultStore, type ResultStore, type StructuredResult } from '../results.js'
import { transactionDetailDataSchema } from '../transactions.js'
import { EXPERIENCE_PROTOCOL_VERSION } from '../version.js'

/** Transaction id from the verified 2026-08-16 localnet payment field run. */
export const FIXTURE_TRANSACTION_ID = 'Y5OGL6BRVN32OAL54AB32C4SXSYAZOMOT3YPIG4N454RRR566YBA'

/** Sender from the verified localnet payment fixture. */
export const FIXTURE_SENDER = 'WPR5O4HW43WM3R3RIGE7XT5QH3TSNER4VYJIGIT2CGS2SKX7P2Y724JCSQ'

/** Receiver from the verified localnet payment fixture. */
export const FIXTURE_RECEIVER = 'L2MGM6VDPH7HME2IVMKLUYCLH5HWSZY7RQIMD5UCCTFNJ4M4DCBRXPSFJE'

/** Opaque result id used to prove view data is referenced rather than copied. */
export const FIXTURE_RESULT_ID = 'result-fixture-transaction-001'

/** Opaque tool-call id used to exercise alternate result addressing. */
export const FIXTURE_TOOL_CALL_ID = 'tool-call-fixture-transaction-001'

const fixtureData = transactionDetailDataSchema.parse({
  id: FIXTURE_TRANSACTION_ID,
  type: 'pay',
  status: 'confirmed',
  sender: FIXTURE_SENDER,
  receiver: FIXTURE_RECEIVER,
  paymentAmountMicroAlgos: 100000,
  feeMicroAlgos: 1000,
  confirmedRound: 8,
})

/** A realistic, deeply immutable, JSON-safe structured transaction result. */
export const transactionFixtureResult: StructuredResult = createResultStore([
  {
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: FIXTURE_RESULT_ID,
    toolCallId: FIXTURE_TOOL_CALL_ID,
    toolName: 'lookup_transaction',
    network: 'localnet',
    data: fixtureData,
  },
])[0]!

/** Creates a fresh immutable result-store value containing the transaction fixture. */
export function createFixtureResultStore(): ResultStore {
  return createResultStore([transactionFixtureResult])
}

/** Creates the trusted view specification for the fixture's authoritative result. */
export function createTransactionFixtureViewSpec(): ViewSpec {
  return transactionDetailViewSpecSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'view',
    view: 'transaction.detail',
    source: { source: 'result', id: FIXTURE_RESULT_ID },
  })
}

type TransactionClassification = Extract<
  ClassifiedExplorerInput,
  { kind: 'entity'; entity: 'transaction' }
>

/** Result of routing direct input against the fixture catalog. */
export type FixtureLookupOutcome =
  | {
      status: 'resolved'
      classification: TransactionClassification
      result: StructuredResult
      view: ViewSpec
      artifact: ExplorerArtifact
    }
  | {
      status: 'ambiguous'
      classification: Extract<ClassifiedExplorerInput, { kind: 'ambiguous-entity' }>
    }
  | {
      status: 'unresolved'
      classification: ClassifiedExplorerInput
    }

/** Classifies direct input and resolves the known fixture to a trusted detail view. */
export function lookupFixture(raw: string): FixtureLookupOutcome {
  const classification = classifyExplorerInput(raw)
  if (
    classification.kind === 'entity' &&
    classification.entity === 'transaction' &&
    classification.value === FIXTURE_TRANSACTION_ID
  ) {
    const view = createTransactionFixtureViewSpec()
    return {
      status: 'resolved',
      classification,
      result: transactionFixtureResult,
      view,
      artifact: { title: 'Transaction detail', view },
    }
  }
  if (classification.kind === 'ambiguous-entity') {
    return { status: 'ambiguous', classification }
  }
  return { status: 'unresolved', classification }
}
