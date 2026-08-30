import { describe, expect, test } from 'bun:test'

import { RECORD_PROTOCOL_VERSION, addResult, createResultStore, viewSpecSchema } from '../../src/actions/index.js'
import { FIXTURE_SENDER, FIXTURE_TRANSACTION_ID } from '../../src/views/sample/index.js'
import { bridgeToolResult, createApplicationDetailViewModel, createAssetDetailViewModel, createBlockDetailViewModel, createTransactionDetailViewModel, createNetworkStatusViewModel, formatBlockTxnType, formatTime, lookupAmbiguousEntity, parseEntityComposerCommand } from '../../src/views/index.js'
import {
  FIXTURE_APPLICATION_ID,
  FIXTURE_ASSET_ID,
  FIXTURE_BLOCK_ROUND,
  createFixtureEntityLookup,
} from '../../src/views/sample/entities.js'
import { formatBlockTime } from '../../src/views/block.js'
import { viewCueForToolResult } from '../../src/views/bridge.js'

const identity = {
  resultId: 'result-entity',
  toolCallId: 'tool-call-entity',
  network: 'localnet' as const,
}

function viewFor(
  record: { resultId: string },
  view:
    | 'asset.detail'
    | 'application.detail'
    | 'block.detail'
    | 'network.status'
    | 'transaction.detail',
) {
  return viewSpecSchema.parse({
    protocolVersion: RECORD_PROTOCOL_VERSION,
    type: 'view',
    view,
    source: { source: 'result', id: record.resultId },
  })
}

describe('directed entity commands', () => {
  test('names one domain and a numeric id', () => {
    expect(parseEntityComposerCommand('asset 1042')).toEqual({ entity: 'asset', id: 1042 })
    expect(parseEntityComposerCommand('ASA 1042')).toEqual({ entity: 'asset', id: 1042 })
    expect(parseEntityComposerCommand('app 1071')).toEqual({ entity: 'application', id: 1071 })
    expect(parseEntityComposerCommand('application 1071')).toEqual({
      entity: 'application',
      id: 1071,
    })
    expect(parseEntityComposerCommand('block 22')).toEqual({ entity: 'block', id: 22 })
    expect(
      parseEntityComposerCommand('group AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE='),
    ).toEqual({
      entity: 'group',
      id: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
    })
  })

  test('leaves bare numbers and malformed input alone', () => {
    expect(parseEntityComposerCommand('1042')).toBeUndefined()
    expect(parseEntityComposerCommand('asset')).toBeUndefined()
    expect(parseEntityComposerCommand('asset -1')).toBeUndefined()
    expect(parseEntityComposerCommand('group abc')).toBeUndefined()
  })
})

describe('fixture entity lookup', () => {
  test('returns typed matches for the sample ids and misses otherwise', async () => {
    const host = createFixtureEntityLookup()
    const asset = await host.lookupAsset(FIXTURE_ASSET_ID)
    const application = await host.lookupApplication(FIXTURE_APPLICATION_ID)
    const block = await host.lookupBlock(FIXTURE_BLOCK_ROUND)

    const assetStore = createResultStore([asset])
    const derivedAsset = createAssetDetailViewModel(assetStore, viewFor(asset, 'asset.detail'))
    if (!derivedAsset.ok) throw new Error(derivedAsset.error.message)
    expect(derivedAsset.model).toMatchObject({
      view: 'asset.detail',
      assetId: FIXTURE_ASSET_ID,
      unitName: 'SMPL',
      decimals: 6,
    })

    const appStore = createResultStore([application])
    const derivedApp = createApplicationDetailViewModel(
      appStore,
      viewFor(application, 'application.detail'),
    )
    if (!derivedApp.ok) throw new Error(derivedApp.error.message)
    expect(derivedApp.model).toMatchObject({
      view: 'application.detail',
      applicationId: FIXTURE_APPLICATION_ID,
      globalStateCount: 1,
    })
    expect(derivedApp.model.account).toMatch(/^[A-Z2-7]{58}$/)

    const blockStore = createResultStore([block])
    const derivedBlock = createBlockDetailViewModel(blockStore, viewFor(block, 'block.detail'))
    if (!derivedBlock.ok) throw new Error(derivedBlock.error.message)
    expect(derivedBlock.model.round).toBe(FIXTURE_BLOCK_ROUND)
    expect(derivedBlock.model.feesCollectedMicroAlgos).toBe(1000)
    expect(derivedBlock.model.previousRound).toBe(FIXTURE_BLOCK_ROUND - 1)
    expect(derivedBlock.model.nextRound).toBe(FIXTURE_BLOCK_ROUND + 1)
    expect(derivedBlock.model.transactionTypes).toEqual([{ type: 'pay', count: 1 }])
    expect(formatBlockTxnType('axfer')).toBe('Asset Transfer')
    expect(formatBlockTxnType('pay')).toBe('Payment')
    expect(formatBlockTime(derivedBlock.model.timestamp)).toBe(
      new Date(1787169189 * 1000).toISOString(),
    )
    expect(formatTime(derivedBlock.model.timestamp)).toBe(
      new Date(1787169189 * 1000).toUTCString().replace(/GMT$/, 'UTC'),
    )

    await expect(host.lookupAsset(1022)).rejects.toThrow(/No sample asset/)
  })

  test('queries asset, application, and block concurrently for a bare id', async () => {
    const host = createFixtureEntityLookup()
    const none = await lookupAmbiguousEntity(host, 1022)
    expect(none.matches).toEqual([])
    expect(none.misses.map((miss) => miss.entity).sort()).toEqual(['application', 'asset', 'block'])

    const assetHit = await lookupAmbiguousEntity(host, FIXTURE_ASSET_ID)
    expect(assetHit.matches.map((match) => match.entity)).toEqual(['asset'])
    expect(assetHit.misses.map((miss) => miss.entity).sort()).toEqual(['application', 'block'])
  })
})

describe('view id', () => {
  test('resolves a trusted declared view and ignores coarse hints', () => {
    expect(
      viewCueForToolResult({
        id: '1',
        toolName: 'my_custom_asa',
        view: 'asset.detail',
        output: {},
        isError: false,
      }),
    ).toBe('asset.detail')
    expect(
      viewCueForToolResult({
        id: '2',
        toolName: 'my_table_tool',
        view: 'json',
        output: {},
        isError: false,
      }),
    ).toBeUndefined()
  })

  test('bridges a lookup_asset wire onto the asset card', () => {
    const bridged = bridgeToolResult(
      {
        id: '1',
        toolName: 'lookup_asset',
        view: 'asset.detail',
        output: {
          assetId: FIXTURE_ASSET_ID,
          name: 'Sample token',
          unitName: 'SMPL',
          totalSupply: '1000000000',
          decimals: 6,
        },
        isError: false,
      },
      identity,
    )
    expect(bridged.view).toBe('asset.detail')
    const store = addResult(createResultStore(), bridged.record)
    const derived = createAssetDetailViewModel(store, viewFor(bridged.record, 'asset.detail'))
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.unitName).toBe('SMPL')
  })

  test('asset detail keeps reserve and other address roles', () => {
    const bridged = bridgeToolResult(
      {
        id: '1',
        toolName: 'lookup_asset',
        view: 'asset.detail',
        output: {
          assetId: FIXTURE_ASSET_ID,
          name: 'Sample token',
          unitName: 'SMPL',
          totalSupply: '1000000000',
          decimals: 6,
          creator: FIXTURE_SENDER,
          manager: FIXTURE_SENDER,
          reserve: FIXTURE_SENDER,
          freeze: FIXTURE_SENDER,
          clawback: FIXTURE_SENDER,
        },
        isError: false,
      },
      identity,
    )
    const store = addResult(createResultStore(), bridged.record)
    const derived = createAssetDetailViewModel(store, viewFor(bridged.record, 'asset.detail'))
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.reserve).toBe(FIXTURE_SENDER)
    expect(derived.model.manager).toBe(FIXTURE_SENDER)
    expect(derived.model.freeze).toBe(FIXTURE_SENDER)
    expect(derived.model.clawback).toBe(FIXTURE_SENDER)
  })

  test('transaction detail keeps named ASA amount, note, and time', () => {
    const bridged = bridgeToolResult(
      {
        id: '1',
        toolName: 'lookup_transaction',
        view: 'transaction.detail',
        output: {
          id: FIXTURE_TRANSACTION_ID,
          type: 'axfer',
          sender: FIXTURE_SENDER,
          receiver: FIXTURE_SENDER,
          feeMicroAlgos: 1000,
          confirmedRound: 64_241_214,
          roundTime: 1_787_169_296,
          assetId: 849_191_641,
          assetAmount: 52_000,
          assetName: 'Hesab Afghani',
          assetUnitName: 'HAFN',
          assetDecimals: 2,
          note: '0464557001787207684-54-16',
        },
        isError: false,
      },
      identity,
    )
    const store = addResult(createResultStore(), bridged.record)
    const derived = createTransactionDetailViewModel(
      store,
      viewFor(bridged.record, 'transaction.detail'),
    )
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.assetName).toBe('Hesab Afghani')
    expect(derived.model.assetUnitName).toBe('HAFN')
    expect(derived.model.assetDecimals).toBe(2)
    expect(derived.model.assetAmount).toBe(52_000)
    expect(derived.model.note).toBe('0464557001787207684-54-16')
  })

  test('transaction detail keeps decoded ABI method, args, and return', () => {
    const bridged = bridgeToolResult(
      {
        id: '1',
        toolName: 'lookup_transaction',
        view: 'transaction.detail',
        output: {
          id: FIXTURE_TRANSACTION_ID,
          type: 'appl',
          sender: FIXTURE_SENDER,
          feeMicroAlgos: 1000,
          confirmedRound: 10,
          applicationId: 1042,
          applicationArgs: ['AQIDBA=='],
          methodName: 'increment',
          methodArgs: [{ name: 'amount', type: 'uint64', value: 7 }],
          methodReturn: 8,
        },
        isError: false,
      },
      identity,
    )
    const store = addResult(createResultStore(), bridged.record)
    const derived = createTransactionDetailViewModel(
      store,
      viewFor(bridged.record, 'transaction.detail'),
    )
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model.methodName).toBe('increment')
    expect(derived.model.methodArgs).toEqual([{ name: 'amount', type: 'uint64', value: 7 }])
    expect(derived.model.methodReturn).toBe(8)
  })

  test('bridges get_network_status onto the network card', () => {
    const bridged = bridgeToolResult(
      {
        id: '1',
        toolName: 'get_network_status',
        view: 'network.status',
        // The full get_network_status wire; the record keeps only the card's metrics.
        output: {
          network: 'localnet',
          latestRound: 22,
          timeSinceLastRound: 0.4,
          totalSupplyMicroAlgos: '10000000000000000',
          onlineStakeMicroAlgos: '1893271111111111',
          participation: 0.9,
          avgBlockTime: 2.8,
          avgTps: 1.5,
          peakTps: 3.1,
          avgTxnPerBlock: 4.2,
          totalTxns: 42,
          minBlockTime: 2.6,
          maxBlockTime: 3.0,
          consensusVersion: 'v40',
          catchupTime: 0,
          blockDetails: [{ round: 22, txnCount: 1, blockTime: 2.8, tps: 1.5 }],
          extraIgnored: true,
        },
        isError: false,
      },
      identity,
    )
    expect(bridged.view).toBe('network.status')
    const store = addResult(createResultStore(), bridged.record)
    const derived = createNetworkStatusViewModel(store, viewFor(bridged.record, 'network.status'))
    if (!derived.ok) throw new Error(derived.error.message)
    expect(derived.model).toMatchObject({
      network: 'localnet',
      latestRound: 22,
      avgTps: 1.5,
      avgBlockTime: 2.8,
      participation: 0.9,
    })
  })
})
