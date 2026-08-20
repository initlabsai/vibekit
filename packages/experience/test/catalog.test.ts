import { describe, expect, test } from 'bun:test'

import {
  EXPERIENCE_PROTOCOL_VERSION,
  FIXTURE_SENDER,
  addResult,
  bridgeToolResult,
  createAccountListViewModel,
  createAccountSummaryViewModel,
  createApplicationLocalsViewModel,
  createApplicationStateViewModel,
  createAssetHoldersViewModel,
  createAssetHoldingsViewModel,
  createAssetListViewModel,
  createBlockDetailViewModel,
  createBlockListViewModel,
  createResultStore,
  createTransactionCollectionViewModel,
  viewSpecSchema,
} from '../src/index.js'

const identity = {
  resultId: 'result-catalog',
  toolCallId: 'tool-call-catalog',
  network: 'localnet' as const,
}

function viewFor(
  record: { resultId: string },
  view:
    | 'account.summary'
    | 'account.list'
    | 'transaction.list'
    | 'transaction.group'
    | 'asset.list'
    | 'asset.holdings'
    | 'asset.holders'
    | 'application.state'
    | 'application.locals'
    | 'block.list',
) {
  return viewSpecSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'view',
    view,
    source: { source: 'result', id: record.resultId },
  })
}

describe('first-party catalog views', () => {
  test('lookup_account becomes an account summary', () => {
    const bridged = bridgeToolResult(
      {
        id: '1',
        toolName: 'lookup_account',
        view: 'account.summary',
        output: {
          address: FIXTURE_SENDER,
          balanceMicroAlgos: 8440000,
          status: 'Offline',
          minBalanceMicroAlgos: 100000,
          totalAssetsOptedIn: 2,
          totalAppsOptedIn: 1,
        },
        isError: false,
      },
      identity,
    )
    expect(bridged.view).toBe('account.summary')
    const derived = createAccountSummaryViewModel(
      addResult(createResultStore(), bridged.record),
      viewFor(bridged.record, 'account.summary'),
    )
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.balanceMicroAlgos).toBe(8440000)
    expect(derived.model.minBalanceMicroAlgos).toBe(100000)
    expect(derived.model.totalAssetsOptedIn).toBe(2)
  })

  test('search_accounts becomes an account list', () => {
    const bridged = bridgeToolResult(
      {
        id: '1',
        toolName: 'search_accounts',
        view: 'account.list',
        output: {
          accounts: [{ address: FIXTURE_SENDER, balanceMicroAlgos: 1000000 }],
          nextToken: 'abc',
        },
        isError: false,
      },
      identity,
    )
    expect(bridged.view).toBe('account.list')
    const derived = createAccountListViewModel(
      addResult(createResultStore(), bridged.record),
      viewFor(bridged.record, 'account.list'),
    )
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.accounts).toHaveLength(1)
    expect(derived.model.nextToken).toBe('abc')
  })

  test('search_transactions becomes a transaction list', () => {
    const bridged = bridgeToolResult(
      {
        id: '1',
        toolName: 'search_transactions',
        view: 'transaction.list',
        output: {
          transactions: [
            {
              id: 'Y5OGL6BRVN32OAL54AB32C4SXSYAZOMOT3YPIG4N454RRR566YBA',
              type: 'pay',
              sender: FIXTURE_SENDER,
              paymentAmountMicroAlgos: 250000,
              feeMicroAlgos: 1000,
              confirmedRound: 22,
              roundTime: 1787169189,
              innerTxns: [{ sender: FIXTURE_SENDER }],
            },
          ],
        },
        isError: false,
      },
      identity,
    )
    expect(bridged.view).toBe('transaction.list')
    const derived = createTransactionCollectionViewModel(
      addResult(createResultStore(), bridged.record),
      viewFor(bridged.record, 'transaction.list'),
    )
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.transactions[0]).toMatchObject({
      paymentAmountMicroAlgos: 250000,
      feeMicroAlgos: 1000,
      confirmedRound: 22,
      roundTime: 1787169189,
      innerCount: 1,
    })
  })

  test('lookup_transaction_group captures the group id', () => {
    const bridged = bridgeToolResult(
      {
        id: '1',
        toolName: 'lookup_transaction_group',
        view: 'transaction.group',
        output: {
          groupId: 'abc123',
          transactions: [
            { type: 'pay', sender: FIXTURE_SENDER, group: 'abc123' },
            { type: 'appl', sender: FIXTURE_SENDER, group: 'abc123', applicationId: 1071 },
          ],
        },
        isError: false,
      },
      identity,
    )
    expect(bridged.view).toBe('transaction.group')
    const derived = createTransactionCollectionViewModel(
      addResult(createResultStore(), bridged.record),
      viewFor(bridged.record, 'transaction.group'),
    )
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.groupId).toBe('abc123')
    expect(derived.model.transactions).toHaveLength(2)
  })

  test('search_assets and search_asset_balances become list and holders cards', () => {
    const assets = bridgeToolResult(
      {
        id: '1',
        toolName: 'search_assets',
        view: 'asset.list',
        output: { assets: [{ assetId: 1042, name: 'Sample', unitName: 'SMPL', totalSupply: '1000', decimals: 0 }] },
        isError: false,
      },
      identity,
    )
    expect(assets.view).toBe('asset.list')
    const assetModel = createAssetListViewModel(
      addResult(createResultStore(), assets.record),
      viewFor(assets.record, 'asset.list'),
    )
    if (!assetModel.ok) throw new Error(assetModel.error.message)
    expect(assetModel.model.assets[0]?.unitName).toBe('SMPL')

    const holders = bridgeToolResult(
      {
        id: '2',
        toolName: 'search_asset_balances',
        view: 'asset.holders',
        output: { balances: [{ address: FIXTURE_SENDER, amount: '12', isFrozen: false }] },
        isError: false,
      },
      { ...identity, resultId: 'result-holders', toolCallId: 'tool-call-holders' },
    )
    expect(holders.view).toBe('asset.holders')
    const holderModel = createAssetHoldersViewModel(
      addResult(createResultStore(), holders.record),
      viewFor(holders.record, 'asset.holders'),
    )
    if (!holderModel.ok) throw new Error(holderModel.error.message)
    expect(holderModel.model.balances[0]?.amount).toBe('12')
  })

  test('get_account_assets renders asset.holdings', () => {
    const holdings = bridgeToolResult(
      {
        id: '1',
        toolName: 'get_account_assets',
        view: 'asset.holdings',
        output: {
          assets: [{ assetId: 1042, amount: '12', isFrozen: false, name: 'Sample', unitName: 'SMPL' }],
        },
        isError: false,
      },
      identity,
    )
    expect(holdings.view).toBe('asset.holdings')
    const model = createAssetHoldingsViewModel(
      addResult(createResultStore(), holdings.record),
      viewFor(holdings.record, 'asset.holdings'),
    )
    if (!model.ok) throw new Error(model.error.message)
    expect(model.model.assets[0]).toEqual({
      assetId: 1042,
      amount: '12',
      isFrozen: false,
      name: 'Sample',
      unitName: 'SMPL',
    })
  })

  test('get_account_app_local_states renders application.locals', () => {
    const locals = bridgeToolResult(
      {
        id: '1',
        toolName: 'get_account_app_local_states',
        view: 'application.locals',
        output: {
          appLocalStates: [
            {
              applicationId: 1071,
              schema: { numByteSlice: 0, numUint: 1 },
              keyValue: [{ key: 'counter', value: { type: 2, uint: 7 } }],
            },
          ],
        },
        isError: false,
      },
      identity,
    )
    expect(locals.view).toBe('application.locals')
    const localsModel = createApplicationLocalsViewModel(
      addResult(createResultStore(), locals.record),
      viewFor(locals.record, 'application.locals'),
    )
    if (!localsModel.ok) throw new Error(localsModel.error.message)
    expect(localsModel.model.apps[0]?.entries[0]).toEqual({ key: 'counter', value: '7', type: 'uint' })
  })

  test('read_global_state and read_local_state share the application.state scope shape', () => {
    const global = bridgeToolResult(
      {
        id: '1',
        toolName: 'read_global_state',
        view: 'application.state',
        output: {
          appId: 1071,
          scope: 'global',
          state: [{ key: 'admin', value: FIXTURE_SENDER, type: 'bytes' }],
        },
        isError: false,
      },
      identity,
    )
    expect(global.view).toBe('application.state')
    const globalModel = createApplicationStateViewModel(
      addResult(createResultStore(), global.record),
      viewFor(global.record, 'application.state'),
    )
    if (!globalModel.ok) throw new Error(globalModel.error.message)
    expect(globalModel.model.scope).toBe('global')
    expect(globalModel.model.applicationId).toBe(1071)
    expect(globalModel.model.address).toBeUndefined()
    expect(globalModel.model.optedIn).toBeUndefined()

    const local = bridgeToolResult(
      {
        id: '2',
        toolName: 'read_local_state',
        view: 'application.state',
        output: {
          appId: 1071,
          scope: 'local',
          address: FIXTURE_SENDER,
          optedIn: true,
          state: [{ key: 'counter', value: 7, type: 'uint' }],
        },
        isError: false,
      },
      { ...identity, resultId: 'result-local', toolCallId: 'tool-call-local' },
    )
    expect(local.view).toBe('application.state')
    const localModel = createApplicationStateViewModel(
      addResult(createResultStore(), local.record),
      viewFor(local.record, 'application.state'),
    )
    if (!localModel.ok) throw new Error(localModel.error.message)
    expect(localModel.model.scope).toBe('local')
    expect(localModel.model.address).toBe(FIXTURE_SENDER)
    expect(localModel.model.optedIn).toBeTrue()
    expect(localModel.model.entries[0]).toEqual({ key: 'counter', value: '7', type: 'uint' })
  })

  test('lookup_block carries type totals, not transaction rows', () => {
    const bridged = bridgeToolResult(
      {
        id: '1',
        toolName: 'lookup_block',
        view: 'block.detail',
        output: {
          round: 22,
          timestamp: 1787169189,
          transactionCount: 1,
          transactionTypes: [{ type: 'pay', count: 1 }],
        },
        isError: false,
      },
      identity,
    )
    expect(bridged.view).toBe('block.detail')
    const derived = createBlockDetailViewModel(
      addResult(createResultStore(), bridged.record),
      viewSpecSchema.parse({
        protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
        type: 'view',
        view: 'block.detail',
        source: { source: 'result', id: bridged.record.resultId },
      }),
    )
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.transactionTypes).toEqual([{ type: 'pay', count: 1 }])
    expect(derived.model.transactionCount).toBe(1)
  })

  test('search_block_headers becomes a block list', () => {
    const bridged = bridgeToolResult(
      {
        id: '1',
        toolName: 'search_block_headers',
        view: 'block.list',
        output: { blocks: [{ round: 22, timestamp: 1787169189, transactionCount: 1 }] },
        isError: false,
      },
      identity,
    )
    expect(bridged.view).toBe('block.list')
    const derived = createBlockListViewModel(
      addResult(createResultStore(), bridged.record),
      viewFor(bridged.record, 'block.list'),
    )
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.blocks[0]?.round).toBe(22)
  })
})
