import { describe, expect, test } from 'bun:test'
import { assetTools } from '../src/index.js'
import { lookupAsset } from '../src/handlers/lookup.js'
import { searchAssetBalances, searchAssetTransactions, searchAssets } from '../src/handlers/search.js'
import { chainable, fakeContext } from './fake-context.js'

const usdcParams = {
  name: 'USDC',
  unitName: 'USDC',
  total: BigInt('18446744073709551615'),
  decimals: 6,
  creator: 'CREATORADDR',
  manager: 'MANAGERADDR',
  reserve: 'RESERVEADDR',
  defaultFrozen: false,
  url: 'https://centre.io',
}

describe('registry', () => {
  test('exports 4 read-only tools with output schemas and display hints', () => {
    expect(assetTools.map((t) => t.name)).toEqual([
      'lookup_asset',
      'search_asset_balances',
      'search_asset_transactions',
      'search_assets',
    ])
    for (const tool of assetTools) {
      expect(tool.requiresSigner ?? false).toBe(false)
      expect(tool.output).toBeDefined()
      expect(tool.display).toBeDefined()
    }
  })
})

describe('lookupAsset', () => {
  test('formats bigint fields and address fields', async () => {
    const ctx = fakeContext({
      indexer: {
        lookupAssetByID: () =>
          chainable({ asset: { index: BigInt(31566704), params: usdcParams } }),
      },
    })
    const asset = await lookupAsset(ctx, { assetId: 31566704 })
    expect(asset.assetId).toBe(31566704)
    expect(asset.name).toBe('USDC')
    expect(asset.totalSupply).toBe('18446744073709551615')
    expect(asset.decimals).toBe(6)
    expect(asset.creator).toBe('CREATORADDR')
    expect(asset.manager).toBe('MANAGERADDR')
    expect(asset.freeze).toBeUndefined()
    expect(asset.clawback).toBeUndefined()
    expect(asset.url).toBe('https://centre.io')
  })
})

describe('searchAssetBalances', () => {
  test('sorts by balance descending, formats with decimals, slices to limit', async () => {
    const ctx = fakeContext({
      indexer: {
        lookupAssetBalances: () =>
          chainable({
            balances: [
              { address: 'SMALL', amount: BigInt(1_000_000), isFrozen: false },
              { address: 'BIG', amount: BigInt(5_500_000), isFrozen: true },
              { address: 'MID', amount: BigInt(2_000_000), isFrozen: false },
            ],
            nextToken: 'tok',
          }),
        lookupAssetByID: () =>
          chainable({ asset: { index: BigInt(31566704), params: usdcParams } }),
      },
    })
    const result = await searchAssetBalances(ctx, { assetId: 31566704, limit: 2 })
    expect(result.balances).toEqual([
      { address: 'BIG', amount: '5.5', isFrozen: true },
      { address: 'MID', amount: '2', isFrozen: false },
    ])
    // page of 3 < 100 → final page, token stripped
    expect(result.nextToken).toBeUndefined()
  })

  test('falls back to raw amounts when the decimals lookup fails', async () => {
    const ctx = fakeContext({
      indexer: {
        lookupAssetBalances: () =>
          chainable({
            balances: [{ address: 'A', amount: BigInt(1_500_000), isFrozen: false }],
          }),
        lookupAssetByID: () => ({
          do: async () => {
            throw new Error('indexer down')
          },
        }),
      },
    })
    const result = await searchAssetBalances(ctx, { assetId: 123 })
    expect(result.balances).toEqual([{ address: 'A', amount: '1,500,000', isFrozen: false }])
  })
})

describe('searchAssetTransactions', () => {
  test('formats payment, asset-transfer, note, and group fields', async () => {
    const ctx = fakeContext({
      indexer: {
        searchForTransactions: () =>
          chainable({
            transactions: [
              {
                id: 'TX1',
                txType: 'axfer',
                sender: 'SENDER',
                fee: BigInt(1000),
                confirmedRound: BigInt(50_000_000),
                roundTime: 1_700_000_000,
                assetTransferTransaction: {
                  assetId: BigInt(31566704),
                  amount: BigInt(100),
                  receiver: 'RECEIVER',
                },
                note: new TextEncoder().encode('hello'),
                group: new Uint8Array([1, 2]),
              },
              {
                id: 'TX2',
                txType: 'pay',
                sender: 'SENDER2',
                fee: BigInt(1000),
                paymentTransaction: { amount: BigInt(2_500_000), receiver: 'PAYEE' },
              },
            ],
            nextToken: 'tok',
          }),
      },
    })
    const result = await searchAssetTransactions(ctx, { assetId: 31566704 })
    expect(result.transactions).toHaveLength(2)
    const [axfer, pay] = result.transactions
    expect(axfer!.assetId).toBe(31566704)
    expect(axfer!.assetAmount).toBe(100)
    expect(axfer!.receiver).toBe('RECEIVER')
    expect(axfer!.confirmedRound).toBe(50_000_000)
    expect(axfer!.fee).toBe(0.001)
    expect(axfer!.note).toBe('hello')
    expect(axfer!.group).toBe('AQI=')
    expect(pay!.paymentAmount).toBe(2.5)
    expect(pay!.receiver).toBe('PAYEE')
    // 2 < default limit 20 → final page
    expect(result.nextToken).toBeUndefined()
  })

  test('caps limit at 100 and keeps token on a full page', async () => {
    let requestedLimit = 0
    const txn = { id: 'T', txType: 'pay', sender: 'S', fee: BigInt(1000) }
    const proxyBase: unknown = new Proxy(
      {},
      {
        get(_obj, prop) {
          if (prop === 'do')
            return async () => ({
              transactions: Array.from({ length: 100 }, () => txn),
              nextToken: 'tok',
            })
          if (prop === 'limit')
            return (l: number) => {
              requestedLimit = l
              return proxyBase
            }
          return () => proxyBase
        },
      },
    )
    const ctx = fakeContext({ indexer: { searchForTransactions: () => proxyBase } })
    const result = await searchAssetTransactions(ctx, { assetId: 1, limit: 500 })
    expect(requestedLimit).toBe(100)
    expect(result.transactions).toHaveLength(100)
    expect(result.nextToken).toBe('tok')
  })
})

describe('searchAssets', () => {
  test('formats assets and strips the final page token', async () => {
    const ctx = fakeContext({
      indexer: {
        searchForAssets: () =>
          chainable({
            assets: [
              { index: BigInt(31566704), params: usdcParams },
              {
                index: BigInt(999),
                params: { total: BigInt(1), decimals: 0, defaultFrozen: true },
              },
            ],
            nextToken: 'tok',
          }),
      },
    })
    const result = await searchAssets(ctx, { name: 'USDC' })
    expect(result.assets).toHaveLength(2)
    expect(result.assets[0]).toMatchObject({
      assetId: 31566704,
      name: 'USDC',
      totalSupply: '18446744073709551615',
      decimals: 6,
    })
    expect(result.assets[1]).toMatchObject({ assetId: 999, totalSupply: '1', defaultFrozen: true })
    expect(result.assets[1]!.name).toBeUndefined()
    expect(result.assets[1]!.creator).toBeUndefined()
    expect(result.nextToken).toBeUndefined()
  })
})
