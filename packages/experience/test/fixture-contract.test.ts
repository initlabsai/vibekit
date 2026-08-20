import { describe, expect, test } from 'bun:test'

import {
  FIXTURE_ARTIFACT_ID,
  FIXTURE_RECEIVER,
  FIXTURE_RESULT_ID,
  FIXTURE_SENDER,
  FIXTURE_TRANSACTION_ID,
  createFixtureResultStore,
  createInitialWorkspaceState,
  createTransactionDetailViewModel,
  lookupFixture,
  selectActiveArtifact,
  transactionDetailDataSchema,
  transactionFixtureResult,
  viewSpecSchema,
  workspaceReducer,
} from '../src/index.js'

function collectLeaves(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(collectLeaves)
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(collectLeaves)
  }
  return [value]
}

describe('fixture-backed transaction vertical slice', () => {
  test('looks up the known transaction and produces a trusted transaction.detail view', () => {
    const lookup = lookupFixture(` ${FIXTURE_TRANSACTION_ID} `)
    expect(lookup.status).toBe('resolved')
    if (lookup.status !== 'resolved') throw new Error('Expected resolved fixture')

    expect(viewSpecSchema.safeParse(lookup.view).success).toBeTrue()
    expect(lookup.view).toEqual({
      protocolVersion: '0.1.0-provisional',
      type: 'view',
      view: 'transaction.detail',
      source: { source: 'result', id: FIXTURE_RESULT_ID },
    })
    expect(lookup.command).toMatchObject({
      command: 'open',
      artifactId: FIXTURE_ARTIFACT_ID,
      view: lookup.view,
    })
  })

  test('keeps authoritative IDs and amounts out of the view specification', () => {
    const lookup = lookupFixture(FIXTURE_TRANSACTION_ID)
    if (lookup.status !== 'resolved') throw new Error('Expected resolved fixture')
    if (transactionFixtureResult.state !== 'success') throw new Error('Expected success fixture')
    const data = transactionDetailDataSchema.parse(transactionFixtureResult.data)
    const leaves = collectLeaves(lookup.view)

    expect(leaves).not.toContain(data.id)
    expect(leaves).not.toContain(data.sender)
    expect(leaves).not.toContain(data.receiver)
    expect(leaves).not.toContain(data.paymentAmountMicroAlgos)
    expect(leaves).not.toContain(data.feeMicroAlgos)
    expect(lookup.view.source.id).toBe(transactionFixtureResult.resultId)
  })

  test('derives the workspace and semantic view model from the structured result', () => {
    const lookup = lookupFixture(FIXTURE_TRANSACTION_ID)
    if (lookup.status !== 'resolved') throw new Error('Expected resolved fixture')
    const store = createFixtureResultStore()
    const workspace = workspaceReducer(createInitialWorkspaceState(), lookup.command)
    const artifact = selectActiveArtifact(workspace)
    if (!artifact) throw new Error('Expected active fixture artifact')
    const selected = createTransactionDetailViewModel(store, artifact.view)

    expect(selected).toMatchObject({
      ok: true,
      model: {
        view: 'transaction.detail',
        network: 'localnet',
        id: FIXTURE_TRANSACTION_ID,
        status: 'confirmed',
        sender: FIXTURE_SENDER,
        receiver: FIXTURE_RECEIVER,
        amountMicroAlgos: 100000,
        feeMicroAlgos: 1000,
        confirmedRound: 8,
      },
    })
    if (!selected.ok) throw new Error('Expected transaction view model')
    expect(JSON.parse(JSON.stringify(selected.model))).toEqual(selected.model)
  })

  test('reports unknown, malformed, and ambiguous direct inputs without model fallback', () => {
    expect(lookupFixture('A'.repeat(52))).toMatchObject({
      status: 'unresolved',
    })
    expect(lookupFixture('not-a-transaction')).toMatchObject({
      status: 'unresolved',
      classification: { kind: 'text' },
    })
    expect(lookupFixture('1022')).toEqual({
      status: 'ambiguous',
      classification: {
        kind: 'ambiguous-entity',
        value: '1022',
        candidates: ['asset', 'application', 'block'],
      },
    })
  })
})
