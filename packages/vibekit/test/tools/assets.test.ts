import { describe, expect, test } from 'bun:test'
import { jsonSafe } from '../../src/core/index.js'
import { assetTools } from '../../src/tools/assets/index.js'
import { lookupAsset } from '../../src/tools/assets/handlers/lookup.js'
import { topAssetHolders } from '../../src/tools/assets/handlers/holders.js'
import {
  searchAssetBalances,
  searchAssetTransactions,
  searchAssets,
} from '../../src/tools/assets/handlers/search.js'
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
  test('exports 5 read-only tools with output schemas and view or display hints', () => {
    expect(assetTools.map((t) => t.name)).toEqual([
      'lookup_asset',
      'top_asset_holders',
      'search_asset_balances',
      'search_asset_transactions',
      'search_assets',
      'get_asset_info',
    ])
    for (const tool of assetTools) {
      expect(tool.requiresSigner ?? false).toBe(false)
      expect(tool.output).toBeDefined()
      expect(tool.view).toBeDefined()
    }
  })
})

describe('topAssetHolders', () => {
  test('pages to exhaustion, sorts by amount, computes percentages', async () => {
    const filler = Array.from({ length: 997 }, (_, i) => ({
      address: `FILLER${i}`,
      amount: BigInt(1),
      isFrozen: false,
    }))
    const pages = [
      {
        balances: [
          { address: 'SMALL', amount: BigInt(100), isFrozen: false },
          { address: 'ZERO', amount: BigInt(0), isFrozen: false },
          { address: 'BIG', amount: BigInt(400_000_000), isFrozen: false },
          ...filler,
        ],
        nextToken: 't1',
      },
      { balances: [{ address: 'MID', amount: BigInt(600_000_000), isFrozen: true }] },
    ]
    let call = 0
    const ctx = fakeContext({
      indexer: {
        lookupAssetBalances: () => chainable(pages[Math.min(call++, 1)]),
        lookupAssetByID: () =>
          chainable({
            asset: { index: BigInt(7), params: { total: BigInt(1_000_000_000), decimals: 6 } },
          }),
      },
    })
    const result = await topAssetHolders(ctx, { assetId: 7, limit: 2 })
    expect(result.holderCount).toBe(1000)
    expect(result.complete).toBe(true)
    expect(result.decimals).toBe(6)
    expect(result.balances.map((b) => b.address)).toEqual(['MID', 'BIG'])
    expect(result.balances[0]).toMatchObject({
      amount: '600000000',
      amountScaled: '600',
      percentOfSupply: 60,
      isFrozen: true,
    })
    expect(result.balances[0]!.amountApprox).toBeUndefined()
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
    expect(asset.totalSupplyScaled).toBe('18,446,744,073,709.551615')
    expect(asset.totalSupplyApprox).toBe('≈18.4 trillion')
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
      { address: 'BIG', amount: '5500000', isFrozen: true },
      { address: 'MID', amount: '2000000', isFrozen: false },
    ])
    expect(result.decimals).toBe(6)
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
    expect(result.balances).toEqual([{ address: 'A', amount: '1500000', isFrozen: false }])
    expect(result.decimals).toBeUndefined()
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
    expect(axfer!.feeMicroAlgos).toBe(1_000)
    expect(axfer!.note).toBe('hello')
    expect(axfer!.group).toBe('AQI=')
    expect(pay!.paymentAmountMicroAlgos).toBe(2_500_000)
    expect(pay!.receiver).toBe('PAYEE')
    // 2 < default limit 20 → final page
    expect(result.nextToken).toBeUndefined()
  })

  test('output schema accepts real indexer shapes: inner txns without id, uint64 amounts above 2^53', async () => {
    const ctx = fakeContext({
      indexer: {
        searchForTransactions: () =>
          chainable({
            transactions: [
              {
                id: 'APPTX',
                txType: 'appl',
                sender: 'CALLER',
                fee: BigInt(2000),
                applicationTransaction: { applicationId: BigInt(1) },
                innerTxns: [
                  {
                    // No id: the indexer assigns none to inner transactions.
                    txType: 'axfer',
                    sender: 'APPADDR',
                    fee: BigInt(0),
                    assetTransferTransaction: {
                      assetId: BigInt(777),
                      amount: BigInt('18446744073709551615'), // max uint64
                      receiver: 'DEST',
                    },
                  },
                ],
              },
            ],
          }),
      },
    })
    const tool = assetTools.find((t) => t.name === 'search_asset_transactions')!
    const wire = jsonSafe(await tool.handler(ctx, { assetId: 777 })) as {
      transactions: Array<{ innerTxns: Array<Record<string, unknown>> }>
    }
    // Above 2^53 the amount must arrive as a decimal string, not a rounded number.
    expect(wire.transactions[0]!.innerTxns[0]!.assetAmount).toBe('18446744073709551615')
    expect(tool.output!.safeParse(wire).success).toBe(true)
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

describe('get_asset_info', () => {
  test('shapes algod response', async () => {
    const creator = 'Y76M3MSY6DKBRHBL7C3NNDXGS5IIMQVQVUAB6MP4XEMMGVF2QWNPL226CA'
    const ctx = fakeContext({
      algod: {
        getAssetByID: () =>
          chainable({
            index: BigInt(42),
            params: {
              name: 'Coin',
              unitName: 'C',
              total: BigInt(9),
              decimals: BigInt(0),
              creator,
            },
          }),
      },
    })
    const tool = assetTools.find((t) => t.name === 'get_asset_info')!
    const info = (await tool.handler(ctx, { assetId: 42 } as never)) as {
      assetId: number
      creator: string
      totalSupply: string
    }
    expect(info.assetId).toBe(42)
    expect(info.creator).toBe(creator)
    expect(info.totalSupply).toBe('9')
  })
})
