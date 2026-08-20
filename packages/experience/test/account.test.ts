import { describe, expect, test } from 'bun:test'

import {
  addResult,
  buildAccountPortfolioRecord,
  EXPERIENCE_PROTOCOL_VERSION,
  createAccountArtifact,
  createAccountPortfolioViewModel,
  createFixtureAccountLookup,
  createFixturePaymentHost,
  createFixtureResultStore,
  createResultStore,
  createTransactionCollectionViewModel,
  FIXTURE_ADDRESS_BOOK,
  FIXTURE_RECEIVER,
  FIXTURE_SENDER,
  FIXTURE_TRANSACTION_ID,
  formatMicroAlgos,
  viewSpecSchema,
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

  test('the account artifact carries a trusted portfolio view', () => {
    const record = buildAccountPortfolioRecord(
      { resultId: 'result-account-002', toolCallId: 'tool-call-account-002', network: 'localnet' },
      RECORDED_WIRE,
    )
    const artifact = createAccountArtifact(record)
    expect(artifact).toMatchObject({
      title: `Account ${FIXTURE_SENDER.slice(0, 6)}…${FIXTURE_SENDER.slice(-4)}`,
      view: { view: 'account.portfolio', source: { source: 'result', id: 'result-account-002' } },
    })
    expect(viewSpecSchema.safeParse(artifact.view).success).toBeTrue()

    const store = addResult(createFixtureResultStore(), record)
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

  test('the sample host serves empty assets/apps and the recorded sender payment', async () => {
    const host = createFixturePaymentHost()
    const assets = await host.lookupAccountAssets(FIXTURE_SENDER)
    expect(assets).toMatchObject({ toolName: 'get_account_assets', data: { assets: [] } })
    const apps = await host.lookupAccountAppStates(FIXTURE_SENDER)
    expect(apps).toMatchObject({
      toolName: 'get_account_app_local_states',
      data: { address: FIXTURE_SENDER, apps: [] },
    })
    const txns = await host.lookupAccountTransactions(FIXTURE_SENDER)
    const derived = createTransactionCollectionViewModel(
      addResult(createResultStore(), txns),
      viewSpecSchema.parse({
        protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
        type: 'view',
        view: 'transaction.list',
        source: { source: 'result', id: txns.resultId },
      }),
    )
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.transactions[0]?.id).toBe(FIXTURE_TRANSACTION_ID)
    const empty = await host.lookupAccountTransactions(FIXTURE_RECEIVER)
    expect(empty.data).toMatchObject({ transactions: [] })
  })

  test('the sample list lookup returns one account.list record', async () => {
    const lookup = createFixtureAccountLookup()
    const record = await lookup.lookupAccounts(FIXTURE_ADDRESS_BOOK.map((entry) => entry.address))
    expect(record).toMatchObject({
      state: 'success',
      toolName: 'batch_lookup_accounts',
      data: {
        accounts: [
          { address: FIXTURE_SENDER, balanceMicroAlgos: 8440000 },
          { address: FIXTURE_RECEIVER, balanceMicroAlgos: 1551000 },
        ],
      },
    })
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
