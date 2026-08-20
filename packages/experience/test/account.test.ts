import { describe, expect, test } from 'bun:test'

import {
  addResult,
  buildAccountPortfolioRecord,
  createAccountOpenCommand,
  createAccountPortfolioViewModel,
  createFixtureAccountLookup,
  createFixtureResultStore,
  createInitialWorkspaceState,
  FIXTURE_ADDRESS_BOOK,
  FIXTURE_SENDER,
  formatMicroAlgos,
  selectActiveArtifact,
  viewSpecSchema,
  workspaceReducer,
} from '../src/index.js'

const RECORDED_WIRE = {
  address: FIXTURE_SENDER,
  algoBalance: 8.44,
  assets: [],
  totalAssets: 0,
}

describe('account portfolio slice', () => {
  test('maps the recorded portfolio wire to exact microALGOs', () => {
    const record = buildAccountPortfolioRecord(
      { resultId: 'result-account-001', toolCallId: 'tool-call-account-001', network: 'localnet' },
      RECORDED_WIRE,
    )
    expect(record).toMatchObject({
      state: 'success',
      toolName: 'get_account_portfolio',
      data: { address: FIXTURE_SENDER, balanceMicroAlgos: 8440000, totalAssets: 0 },
    })
  })

  test('the open command drives the workspace to a trusted portfolio view', () => {
    const record = buildAccountPortfolioRecord(
      { resultId: 'result-account-002', toolCallId: 'tool-call-account-002', network: 'localnet' },
      RECORDED_WIRE,
    )
    const command = createAccountOpenCommand(record)
    expect(command).toMatchObject({
      command: 'open',
      artifactId: `artifact-account-${FIXTURE_SENDER}`,
      view: { view: 'account.portfolio', source: { source: 'result', id: 'result-account-002' } },
    })

    const store = addResult(createFixtureResultStore(), record)
    const workspace = workspaceReducer(createInitialWorkspaceState(), command)
    const artifact = selectActiveArtifact(workspace)
    if (!artifact) throw new Error('Expected account artifact')
    expect(viewSpecSchema.safeParse(artifact.view).success).toBeTrue()

    const derived = createAccountPortfolioViewModel(store, artifact.view)
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model).toEqual({
      view: 'account.portfolio',
      network: 'localnet',
      address: FIXTURE_SENDER,
      balanceMicroAlgos: 8440000,
      totalAssets: 0,
      assets: [],
    })
    expect(formatMicroAlgos(derived.model.balanceMicroAlgos)).toBe('8.44')
  })

  test('the sample lookup replays only the two recorded accounts', async () => {
    const lookup = createFixtureAccountLookup()
    for (const entry of FIXTURE_ADDRESS_BOOK) {
      const record = await lookup.lookupAccount(entry.address)
      expect(record).toMatchObject({ state: 'success', toolName: 'get_account_portfolio' })
    }
    await expect(
      lookup.lookupAccount(
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'.slice(0, 58),
      ),
    ).rejects.toThrow('sample accounts')
  })

  test('an account view rejects transaction data and vice versa', () => {
    const record = buildAccountPortfolioRecord(
      { resultId: 'result-account-003', toolCallId: 'tool-call-account-003', network: 'localnet' },
      RECORDED_WIRE,
    )
    const store = addResult(createFixtureResultStore(), record)
    // Point an account view at the transaction fixture record.
    const wrong = createAccountPortfolioViewModel(store, {
      protocolVersion: '0.1.0-provisional',
      type: 'view',
      view: 'account.portfolio',
      source: { source: 'result', id: 'result-fixture-transaction-001' },
    })
    expect(wrong).toMatchObject({ ok: false, error: { code: 'INVALID_VIEW_DATA' } })
  })
})
