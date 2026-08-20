import { describe, expect, test } from 'bun:test'
import { jsonSafe } from '@initlabs/vibekit-core'
import { transactionTools } from '../src/transactions/index.js'
import { lookupTransaction, lookupTransactionGroup } from '../src/transactions/handlers/lookup.js'
import { searchTransactions } from '../src/transactions/handlers/search.js'
import { chainable, fakeContext } from './fake-context.js'

describe('registry', () => {
  test('exports 3 read-only tools with output schemas and display hints', () => {
    expect(transactionTools.map((t) => t.name)).toEqual([
      'lookup_transaction',
      'search_transactions',
      'lookup_transaction_group',
    ])
    for (const tool of transactionTools) {
      expect(tool.requiresSigner ?? false).toBe(false)
      expect(tool.output).toBeDefined()
      expect(tool.view ?? tool.display).toBeDefined()
    }
  })
})

describe('lookupTransaction', () => {
  test('formats a payment transaction with note, group, and logs', async () => {
    const ctx = fakeContext({
      indexer: {
        lookupTransactionByID: (txid: string) =>
          chainable({
            transaction: {
              id: txid,
              txType: 'pay',
              sender: 'SENDER',
              fee: BigInt(1_000),
              confirmedRound: BigInt(42),
              roundTime: BigInt(1_700_000_000),
              paymentTransaction: { amount: BigInt(2_500_000), receiver: 'RECEIVER' },
              note: new TextEncoder().encode('hello'),
              group: new Uint8Array([1, 2, 3]),
              logs: [new Uint8Array([4, 5])],
            },
          }),
      },
    })
    const tx = await lookupTransaction(ctx, { txid: 'TXID' })
    expect(tx.id).toBe('TXID')
    expect(tx.type).toBe('pay')
    expect(tx.sender).toBe('SENDER')
    expect(tx.feeMicroAlgos).toBe(1_000)
    expect(tx.confirmedRound).toBe(42)
    expect(tx.roundTime).toBe(1_700_000_000)
    expect(tx.paymentAmountMicroAlgos).toBe(2_500_000)
    expect(tx.receiver).toBe('RECEIVER')
    expect(tx.note).toBe('hello')
    expect(tx.group).toBe('AQID')
    expect(tx.logs).toEqual(['BAU='])
    expect(tx.assetId).toBeUndefined()
  })

  test('enriches an asset transfer with algod params and clawback/close fields', async () => {
    const ctx = fakeContext({
      indexer: {
        lookupTransactionByID: (txid: string) =>
          chainable({
            transaction: {
              id: txid,
              txType: 'axfer',
              sender: 'CLAWBACK',
              fee: BigInt(1_000),
              confirmedRound: BigInt(64_241_214),
              roundTime: BigInt(1_787_169_296),
              rekeyTo: 'REKEY',
              assetTransferTransaction: {
                assetId: BigInt(849_191_641),
                amount: BigInt(52_000),
                receiver: 'RECEIVER',
                sender: 'VICTIM',
                closeTo: 'CLOSE',
                closeAmount: BigInt(10),
              },
            },
          }),
      },
      algod: {
        getAssetByID: () =>
          chainable({
            index: BigInt(849_191_641),
            params: { name: 'Hesab Afghani', unitName: 'HAFN', decimals: 2 },
          }),
      },
    })
    const tx = await lookupTransaction(ctx, { txid: 'AXFER' })
    expect(tx.assetId).toBe(849_191_641)
    expect(tx.assetAmount).toBe(52_000)
    expect(tx.assetName).toBe('Hesab Afghani')
    expect(tx.assetUnitName).toBe('HAFN')
    expect(tx.assetDecimals).toBe(2)
    expect(tx.clawbackFrom).toBe('VICTIM')
    expect(tx.closeTo).toBe('CLOSE')
    expect(tx.closeAssetAmount).toBe(10)
    expect(tx.rekeyTo).toBe('REKEY')
  })

  test('still returns an asset transfer when algod asset lookup fails', async () => {
    const ctx = fakeContext({
      indexer: {
        lookupTransactionByID: () =>
          chainable({
            transaction: {
              id: 'AXFER',
              txType: 'axfer',
              sender: 'SENDER',
              fee: BigInt(1_000),
              assetTransferTransaction: {
                assetId: BigInt(7),
                amount: BigInt(1),
                receiver: 'RECEIVER',
              },
            },
          }),
      },
      algod: {
        getAssetByID: () => {
          throw new Error('offline')
        },
      },
    })
    const tx = await lookupTransaction(ctx, { txid: 'AXFER' })
    expect(tx.assetId).toBe(7)
    expect(tx.assetName).toBeUndefined()
  })

  test('formats an app call with inner asset transfer txns', async () => {
    const ctx = fakeContext({
      indexer: {
        lookupTransactionByID: () =>
          chainable({
            transaction: {
              id: 'APPTX',
              txType: 'appl',
              sender: 'CALLER',
              fee: BigInt(2_000),
              applicationTransaction: { applicationId: BigInt(123) },
              globalStateDelta: [{ key: 'aw==' }],
              innerTxns: [
                {
                  id: 'INNER',
                  txType: 'axfer',
                  sender: 'APPADDR',
                  fee: BigInt(0),
                  assetTransferTransaction: {
                    assetId: BigInt(777),
                    amount: BigInt(9_000),
                    receiver: 'DEST',
                  },
                },
              ],
            },
          }),
      },
    })
    const tx = await lookupTransaction(ctx, { txid: 'APPTX' })
    expect(tx.applicationId).toBe(123)
    expect(tx.globalStateDelta).toEqual([{ key: 'aw==' }])
    expect(tx.innerTxns).toHaveLength(1)
    expect(tx.innerTxns?.[0]?.assetId).toBe(777)
    expect(tx.innerTxns?.[0]?.assetAmount).toBe(9_000)
    expect(tx.innerTxns?.[0]?.receiver).toBe('DEST')
    expect(tx.innerTxns?.[0]?.confirmedRound).toBeUndefined()
  })

  test('formats an asset freeze with target, status, and asset enrichment', async () => {
    const ctx = fakeContext({
      indexer: {
        lookupTransactionByID: () =>
          chainable({
            transaction: {
              id: 'FRZ',
              txType: 'afrz',
              sender: 'FREEZEADMIN',
              fee: BigInt(1_000),
              assetFreezeTransaction: {
                address: 'FROZENACCOUNT',
                assetId: BigInt(4321),
                newFreezeStatus: true,
              },
            },
          }),
      },
      algod: {
        getAssetByID: () =>
          chainable({ index: BigInt(4321), params: { unitName: 'ICE', decimals: 0 } }),
      },
    })
    const tx = await lookupTransaction(ctx, { txid: 'FRZ' })
    expect(tx.assetId).toBe(4321)
    expect(tx.freezeTarget).toBe('FROZENACCOUNT')
    expect(tx.frozen).toBe(true)
    expect(tx.assetUnitName).toBe('ICE')
  })

  test('formats an asset create: assetId 0, createdAssetId, and the config body', async () => {
    let algodCalls = 0
    const ctx = fakeContext({
      indexer: {
        lookupTransactionByID: () =>
          chainable({
            transaction: {
              id: 'ACREATE',
              txType: 'acfg',
              sender: 'CREATOR',
              fee: BigInt(1_000),
              createdAssetIndex: BigInt(987_654),
              assetConfigTransaction: {
                // The indexer omits assetId entirely on creates.
                params: {
                  creator: 'CREATOR',
                  total: BigInt('18446744073709551615'),
                  decimals: 6,
                  unitName: 'MAX',
                  name: 'Max Coin',
                  url: 'https://max.example',
                  manager: 'MANAGER',
                  reserve: 'RESERVE',
                  freeze: 'FREEZER',
                  clawback: 'CLAWBACK',
                  defaultFrozen: false,
                },
              },
            },
          }),
      },
      algod: {
        getAssetByID: () => {
          algodCalls += 1
          throw new Error('must not be called for asset 0')
        },
      },
    })
    const tx = await lookupTransaction(ctx, { txid: 'ACREATE' })
    expect(tx.assetId).toBe(0)
    expect(tx.createdAssetId).toBe(987_654)
    expect(tx.assetConfig).toEqual({
      total: '18446744073709551615',
      decimals: 6,
      unitName: 'MAX',
      assetName: 'Max Coin',
      url: 'https://max.example',
      manager: 'MANAGER',
      reserve: 'RESERVE',
      freeze: 'FREEZER',
      clawback: 'CLAWBACK',
      defaultFrozen: false,
    })
    expect(algodCalls).toBe(0)
  })

  test('formats an asset destroy: assetId without a config body', async () => {
    const ctx = fakeContext({
      indexer: {
        lookupTransactionByID: () =>
          chainable({
            transaction: {
              id: 'ADESTROY',
              txType: 'acfg',
              sender: 'MANAGER',
              fee: BigInt(1_000),
              assetConfigTransaction: { assetId: BigInt(987_654) },
            },
          }),
      },
      algod: {
        getAssetByID: () => {
          throw new Error('deleted asset')
        },
      },
    })
    const tx = await lookupTransaction(ctx, { txid: 'ADESTROY' })
    expect(tx.assetId).toBe(987_654)
    expect(tx.assetConfig).toBeUndefined()
  })

  test('formats an app create with createdApplicationId and a rekeyed signer', async () => {
    const ctx = fakeContext({
      indexer: {
        lookupTransactionByID: () =>
          chainable({
            transaction: {
              id: 'APPCREATE',
              txType: 'appl',
              sender: 'DEPLOYER',
              fee: BigInt(1_000),
              authAddr: 'ACTUALSIGNER',
              createdApplicationIndex: BigInt(3_679_982_959),
              applicationTransaction: { applicationId: BigInt(0), onCompletion: 'noop' },
            },
          }),
      },
    })
    const tx = await lookupTransaction(ctx, { txid: 'APPCREATE' })
    expect(tx.applicationId).toBe(0)
    expect(tx.createdApplicationId).toBe(3_679_982_959)
    expect(tx.signer).toBe('ACTUALSIGNER')
  })

  test('output schema accepts the new acfg/afrz/created/signer fields on the wire', async () => {
    const ctx = fakeContext({
      indexer: {
        lookupTransactionByID: () =>
          chainable({
            transaction: {
              id: 'ACREATE',
              txType: 'acfg',
              sender: 'CREATOR',
              fee: BigInt(1_000),
              authAddr: 'ACTUALSIGNER',
              createdAssetIndex: BigInt(987_654),
              assetConfigTransaction: {
                params: { creator: 'CREATOR', total: BigInt(1_000), decimals: 0 },
              },
            },
          }),
      },
    })
    const tool = transactionTools.find((t) => t.name === 'lookup_transaction')!
    const wire = jsonSafe(await tool.handler(ctx, { txid: 'ACREATE' }))
    const parsed = tool.output!.safeParse(wire)
    expect(parsed.success).toBe(true)
  })

  test('output schema accepts real indexer shapes: inner txns without id, uint64 amounts above 2^53', async () => {
    const hugeAmount = BigInt('18446744073709551615') // max uint64
    const ctx = fakeContext({
      indexer: {
        lookupTransactionByID: () =>
          chainable({
            transaction: {
              id: 'APPTX',
              txType: 'appl',
              sender: 'CALLER',
              fee: BigInt(2_000),
              applicationTransaction: { applicationId: BigInt(123) },
              innerTxns: [
                {
                  // The indexer assigns NO id (and this model field is
                  // optional) on inner transactions — the schema must accept
                  // the absent key or every DeFi lookup throws OUTPUT_MISMATCH.
                  txType: 'axfer',
                  sender: 'APPADDR',
                  fee: BigInt(0),
                  assetTransferTransaction: {
                    assetId: BigInt(777),
                    amount: hugeAmount,
                    receiver: 'DEST',
                  },
                },
              ],
            },
          }),
      },
    })
    const tool = transactionTools.find((t) => t.name === 'lookup_transaction')!
    const wire = jsonSafe(await tool.handler(ctx, { txid: 'APPTX' })) as {
      innerTxns: Array<Record<string, unknown>>
    }
    // Above 2^53 the amount must arrive as a decimal string, not a rounded number.
    expect(wire.innerTxns[0]!.assetAmount).toBe('18446744073709551615')
    const parsed = tool.output!.safeParse(wire)
    expect(parsed.success).toBe(true)
  })
})

describe('searchTransactions', () => {
  test('caps limit at 100 and strips final page token', async () => {
    let requestedLimit = 0
    const proxyBase: unknown = new Proxy(
      {},
      {
        get(_obj, prop) {
          if (prop === 'do')
            return async () => ({
              transactions: [{ id: 'T1', txType: 'pay', sender: 'S', fee: BigInt(1_000) }],
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
    const result = await searchTransactions(ctx, { limit: 500 })
    expect(requestedLimit).toBe(100)
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0]?.feeMicroAlgos).toBe(1_000)
    expect(result.nextToken).toBeUndefined() // 1 < 100 → final page
  })

  test('applies filters, converts minAmount to currencyGreaterThan(minAmount - 1), keeps full-page token', async () => {
    const calls: Record<string, unknown[]> = {}
    const proxyBase: unknown = new Proxy(
      {},
      {
        get(_obj, prop) {
          if (prop === 'do')
            return async () => ({
              transactions: Array.from({ length: 20 }, (_, i) => ({
                id: `T${i}`,
                txType: 'axfer',
                sender: 'S',
                fee: BigInt(1_000),
                assetTransferTransaction: {
                  assetId: BigInt(31566704),
                  amount: BigInt(5_000_000),
                  receiver: 'R',
                },
              })),
              nextToken: 'next-page',
            })
          return (...args: unknown[]) => {
            calls[String(prop)] = args
            return proxyBase
          }
        },
      },
    )
    const ctx = fakeContext({ indexer: { searchForTransactions: () => proxyBase } })
    const result = await searchTransactions(ctx, {
      txType: 'axfer',
      assetId: 31566704,
      minAmount: 1_000_000,
      minRound: 10,
      nextToken: 'prev',
    })
    expect(calls.txType).toEqual(['axfer'])
    expect(calls.assetID).toEqual([31566704])
    expect(calls.currencyGreaterThan).toEqual([999_999])
    expect(calls.minRound).toEqual([10])
    expect(calls.nextToken).toEqual(['prev'])
    expect(calls.limit).toEqual([20]) // DEFAULT_LIMIT
    expect(result.transactions).toHaveLength(20)
    expect(result.transactions[0]?.assetAmount).toBe(5_000_000)
    expect(result.nextToken).toBe('next-page') // full page → token kept
  })

  test('returns empty list when indexer omits transactions', async () => {
    const ctx = fakeContext({
      indexer: { searchForTransactions: () => chainable({ nextToken: undefined }) },
    })
    const result = await searchTransactions(ctx, {})
    expect(result.transactions).toEqual([])
    expect(result.nextToken).toBeUndefined()
  })
})

describe('lookupTransactionGroup', () => {
  test('queries by group id with limit 100 and strips final token', async () => {
    const calls: Record<string, unknown[]> = {}
    const proxyBase: unknown = new Proxy(
      {},
      {
        get(_obj, prop) {
          if (prop === 'do')
            return async () => ({
              transactions: [
                {
                  id: 'G1',
                  txType: 'pay',
                  sender: 'A',
                  fee: BigInt(1_000),
                  group: new Uint8Array([9]),
                  paymentTransaction: { amount: BigInt(1_000_000), receiver: 'B' },
                },
                { id: 'G2', txType: 'appl', sender: 'A', fee: BigInt(1_000) },
              ],
              nextToken: 'tok',
            })
          return (...args: unknown[]) => {
            calls[String(prop)] = args
            return proxyBase
          }
        },
      },
    )
    const ctx = fakeContext({ indexer: { searchForTransactions: () => proxyBase } })
    const result = await lookupTransactionGroup(ctx, { groupId: 'CQ==' })
    expect(calls.groupid).toEqual(['CQ=='])
    expect(calls.limit).toEqual([100])
    expect(result.groupId).toBe('CQ==')
    expect(result.transactions.map((t) => t.id)).toEqual(['G1', 'G2'])
    expect(result.transactions[0]?.group).toBe('CQ==')
    expect(result.transactions[0]?.paymentAmountMicroAlgos).toBe(1_000_000)
    expect(result.nextToken).toBeUndefined() // 2 < 100 → final page
  })
})
