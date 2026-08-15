import { describe, expect, test } from 'bun:test'
import { ToolError } from '@initlabs/core'
import algosdk from 'algosdk'
import { getAccountAppLocalStates, getAccountAssets } from '../src/handlers/assets.js'
import { batchLookupAccounts, lookupAccount } from '../src/handlers/lookup.js'
import { getAccountPortfolio } from '../src/handlers/portfolio.js'
import { searchAccounts, searchAccountTransactions } from '../src/handlers/search.js'
import { accountTools } from '../src/index.js'
import { chainable, fakeContext } from './fake-context.js'

const ADDR = algosdk.generateAccount().addr.toString()
const ADDR2 = algosdk.generateAccount().addr.toString()

/** A chainable stub whose .do() rejects. */
function failing(message: string): unknown {
  const proxy: unknown = new Proxy(
    {},
    {
      get(_obj, prop) {
        if (prop === 'do') return async () => Promise.reject(new Error(message))
        return () => proxy
      },
    },
  )
  return proxy
}

function fakeIndexerAccount(address: string, amount: bigint) {
  return {
    address,
    amount,
    totalAssetsOptedIn: 3,
    totalAppsOptedIn: 1,
    totalCreatedAssets: 0,
    totalCreatedApps: 2,
    status: 'Offline',
    rewardBase: BigInt(218288),
    createdAtRound: BigInt(1_000_000),
  }
}

describe('registry', () => {
  test('exports 7 read-only tools with output schemas and display hints', () => {
    expect(accountTools.map((t) => t.name)).toEqual([
      'lookup_account',
      'batch_lookup_accounts',
      'search_accounts',
      'search_account_transactions',
      'get_account_assets',
      'get_account_app_local_states',
      'get_account_portfolio',
    ])
    for (const tool of accountTools) {
      expect(tool.requiresSigner ?? false).toBe(false)
      expect(tool.output).toBeDefined()
      expect(tool.display).toBeDefined()
    }
  })
})

describe('lookupAccount', () => {
  test('formats account with algo conversion and bigint round fields', async () => {
    const ctx = fakeContext({
      indexer: {
        lookupAccountByID: () => chainable({ account: fakeIndexerAccount(ADDR, BigInt(2_500_000)) }),
      },
    })
    const account = await lookupAccount(ctx, { address: ADDR })
    expect(account.address).toBe(ADDR)
    expect(account.balanceAlgos).toBe(2.5)
    expect(account.totalAssetsOptedIn).toBe(3)
    expect(account.status).toBe('Offline')
    expect(account.rewardBase).toBe(218288)
    expect(account.createdAtRound).toBe(1_000_000)
  })

  test('throws ToolError on invalid address', async () => {
    const ctx = fakeContext({})
    expect(lookupAccount(ctx, { address: 'not-an-address' })).rejects.toThrow(ToolError)
  })
})

describe('batchLookupAccounts', () => {
  test('returns fulfilled lookups and drops failed ones', async () => {
    const ctx = fakeContext({
      indexer: {
        lookupAccountByID: (address: string) =>
          address === ADDR
            ? chainable({ account: fakeIndexerAccount(ADDR, BigInt(1_000_000)) })
            : failing('not found'),
      },
    })
    const result = await batchLookupAccounts(ctx, { addresses: [ADDR, ADDR2] })
    expect(result.accounts).toHaveLength(1)
    expect(result.accounts[0].address).toBe(ADDR)
    expect(result.accounts[0].balanceAlgos).toBe(1)
  })

  test('throws ToolError when any address is invalid', async () => {
    const ctx = fakeContext({})
    expect(batchLookupAccounts(ctx, { addresses: [ADDR, 'bogus'] })).rejects.toThrow(ToolError)
  })
})

describe('searchAccounts', () => {
  test('caps limit at 100 and strips final page token', async () => {
    let requestedLimit = 0
    const proxyBase: unknown = new Proxy(
      {},
      {
        get(_obj, prop) {
          if (prop === 'do')
            return async () => ({
              accounts: [fakeIndexerAccount(ADDR, BigInt(5_000_000))],
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
    const ctx = fakeContext({ indexer: { searchAccounts: () => proxyBase } })
    const result = await searchAccounts(ctx, { limit: 500 })
    expect(requestedLimit).toBe(100)
    expect(result.accounts).toHaveLength(1)
    expect(result.accounts[0].balanceAlgos).toBe(5)
    expect(result.nextToken).toBeUndefined() // 1 < 100 → final page
  })

  test('keeps nextToken when the page is full', async () => {
    const accounts = Array.from({ length: 2 }, () => fakeIndexerAccount(ADDR, BigInt(0)))
    const ctx = fakeContext({
      indexer: { searchAccounts: () => chainable({ accounts, nextToken: 'tok' }) },
    })
    const result = await searchAccounts(ctx, { limit: 2 })
    expect(result.nextToken).toBe('tok')
  })
})

describe('searchAccountTransactions', () => {
  test('formats payment transactions with note, group, and inner txns', async () => {
    const ctx = fakeContext({
      indexer: {
        searchForTransactions: () =>
          chainable({
            transactions: [
              {
                id: 'TXID1',
                txType: 'pay',
                sender: ADDR,
                fee: BigInt(1_000),
                confirmedRound: BigInt(42),
                roundTime: 1_700_000_000,
                paymentTransaction: { amount: BigInt(7_000_000), receiver: ADDR2 },
                note: new TextEncoder().encode('hello'),
                group: new Uint8Array([1, 2]),
                innerTxns: [
                  {
                    id: 'INNER1',
                    txType: 'axfer',
                    sender: ADDR2,
                    fee: BigInt(0),
                    assetTransferTransaction: {
                      assetId: BigInt(31566704),
                      amount: BigInt(123),
                      receiver: ADDR,
                    },
                  },
                ],
              },
            ],
            nextToken: 'tok',
          }),
      },
    })
    const result = await searchAccountTransactions(ctx, { address: ADDR })
    const tx = result.transactions[0]
    expect(tx.id).toBe('TXID1')
    expect(tx.fee).toBe(0.001)
    expect(tx.confirmedRound).toBe(42)
    expect(tx.paymentAmount).toBe(7)
    expect(tx.receiver).toBe(ADDR2)
    expect(tx.note).toBe('hello')
    expect(tx.group).toBe('AQI=')
    expect(tx.innerTxns).toHaveLength(1)
    expect(tx.innerTxns?.[0].assetId).toBe(31566704)
    expect(tx.innerTxns?.[0].assetAmount).toBe(123)
    expect(result.nextToken).toBeUndefined() // 1 < default limit → final page
  })

  test('throws ToolError on invalid address', async () => {
    const ctx = fakeContext({})
    expect(searchAccountTransactions(ctx, { address: 'bogus' })).rejects.toThrow(ToolError)
  })
})

describe('getAccountAssets', () => {
  test('enriches holdings with asset metadata and formats amounts by decimals', async () => {
    const ctx = fakeContext({
      indexer: {
        lookupAccountAssets: () =>
          chainable({
            assets: [{ assetId: BigInt(31566704), amount: BigInt(2_500_000), isFrozen: false }],
            nextToken: 'tok',
          }),
        lookupAssetByID: () =>
          chainable({
            asset: { params: { name: 'USDC', unitName: 'USDC', decimals: 6 } },
          }),
      },
    })
    const result = await getAccountAssets(ctx, { address: ADDR })
    expect(result.assets).toEqual([
      { assetId: 31566704, amount: '2.5', isFrozen: false, name: 'USDC', unitName: 'USDC' },
    ])
    expect(result.nextToken).toBeUndefined()
  })

  test('falls back to raw amount when metadata lookup fails', async () => {
    const ctx = fakeContext({
      indexer: {
        lookupAccountAssets: () =>
          chainable({
            assets: [{ assetId: BigInt(99), amount: BigInt(1234), isFrozen: true }],
          }),
        lookupAssetByID: () => failing('rate limited'),
      },
    })
    const result = await getAccountAssets(ctx, { address: ADDR })
    expect(result.assets).toEqual([{ assetId: 99, amount: '1234', isFrozen: true }])
  })

  test('throws ToolError on invalid address', async () => {
    const ctx = fakeContext({})
    expect(getAccountAssets(ctx, { address: 'bogus' })).rejects.toThrow(ToolError)
  })
})

describe('getAccountAppLocalStates', () => {
  test('formats schema and key-value pairs with base64 keys', async () => {
    const ctx = fakeContext({
      indexer: {
        lookupAccountAppLocalStates: () =>
          chainable({
            appsLocalStates: [
              {
                id: BigInt(123),
                schema: { numByteSlice: BigInt(1), numUint: BigInt(2) },
                keyValue: [
                  {
                    key: new Uint8Array([1, 2]),
                    value: { type: 2, bytes: new Uint8Array(0), uint: BigInt(7) },
                  },
                ],
              },
            ],
            nextToken: 'tok',
          }),
      },
    })
    const result = await getAccountAppLocalStates(ctx, { address: ADDR })
    expect(result.appLocalStates).toEqual([
      {
        applicationId: 123,
        schema: { numByteSlice: 1, numUint: 2 },
        keyValue: [{ key: 'AQI=', value: { type: 2, bytes: '', uint: 7 } }],
      },
    ])
    expect(result.nextToken).toBeUndefined() // 1 < default limit → final page
  })

  test('throws ToolError on invalid address', async () => {
    const ctx = fakeContext({})
    expect(getAccountAppLocalStates(ctx, { address: 'bogus' })).rejects.toThrow(ToolError)
  })
})

describe('getAccountPortfolio', () => {
  test('computes algo balance and paginates asset holdings', async () => {
    let assetPageCalls = 0
    const ctx = fakeContext({
      indexer: {
        lookupAccountByID: () => chainable({ account: { amount: BigInt(9_000_000) } }),
        lookupAccountAssets: () => {
          assetPageCalls++
          return assetPageCalls === 1
            ? chainable({
                assets: Array.from({ length: 100 }, (_, i) => ({
                  assetId: BigInt(i + 1),
                  amount: BigInt(10),
                  isFrozen: false,
                })),
                nextToken: 'page2',
              })
            : chainable({
                assets: [{ assetId: BigInt(999), amount: BigInt(5), isFrozen: false }],
              })
        },
        lookupAssetByID: () => failing('no metadata'),
      },
    })
    const result = await getAccountPortfolio(ctx, { address: ADDR })
    expect(assetPageCalls).toBe(2)
    expect(result.address).toBe(ADDR)
    expect(result.algoBalance).toBe(9)
    expect(result.assets).toHaveLength(101)
    expect(result.totalAssets).toBe(101)
    expect(result.assets[100]).toEqual({ assetId: 999, amount: '5', isFrozen: false })
  })

  test('throws ToolError on invalid address', async () => {
    const ctx = fakeContext({})
    expect(getAccountPortfolio(ctx, { address: 'bogus' })).rejects.toThrow(ToolError)
  })
})
