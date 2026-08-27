import { describe, expect, test } from 'bun:test'
import algosdk from 'algosdk'
import {
  composeOrExecute,
  buildGroup,
  resolveAbiMethod,
  simulateGroup,
} from '../../src/core/compose/index.js'
import type { TxnSpec } from '../../src/core/compose/types.js'
import { base64ToBytes } from '../../src/core/codec.js'
import { resolveNetwork } from '../../src/core/network.js'
import { ToolError } from '../../src/core/errors.js'
import type { ToolContext } from '../../src/core/contract.js'

const ADDR_A = 'Y76M3MSY6DKBRHBL7C3NNDXGS5IIMQVQVUAB6MP4XEMMGVF2QWNPL226CA'
const ADDR_B = 'OXNTQ2K3DTDMQVKV2PWQW6AYMSVZHEWJ6EPSUONVCZECIOAVPNNHIHVN3Y'

const suggestedParams: algosdk.SuggestedParams = {
  flatFee: false,
  fee: BigInt(0),
  minFee: BigInt(1000),
  firstValid: BigInt(1000),
  lastValid: BigInt(2000),
  genesisID: 'testnet-v1.0',
  genesisHash: new Uint8Array(32),
}

function fakeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    network: resolveNetwork('localnet'),
    servedNetworks: ['localnet'],
    defaultNetwork: 'localnet',
    algod: {
      getTransactionParams: () => ({ do: async () => suggestedParams }),
    } as unknown as ToolContext['algod'],
    indexer: {} as ToolContext['indexer'],
    mode: 'compose',
    services: {},
    ...overrides,
  }
}

describe('composeOrExecute (compose mode)', () => {
  test('single payment: returns decodable unsigned txn + summary', async () => {
    const result = await composeOrExecute(fakeCtx(), [
      { type: 'payment', sender: ADDR_A, receiver: ADDR_B, amountMicroAlgos: 1000, note: 'hi' },
    ])
    if (!('unsignedGroup' in result)) throw new Error('expected compose result')
    expect(result.unsignedGroup).toHaveLength(1)
    const txn = algosdk.decodeUnsignedTransaction(base64ToBytes(result.unsignedGroup[0]!))
    expect(txn.payment?.amount).toBe(BigInt(1000))
    expect(result.summary).toContain('pay 1000 microALGO')
  })

  test('multi-txn group gets a shared group id', async () => {
    const result = await composeOrExecute(fakeCtx(), [
      { type: 'payment', sender: ADDR_A, receiver: ADDR_B, amountMicroAlgos: 1 },
      { type: 'asset_opt_in', sender: ADDR_A, assetId: 123 },
    ])
    if (!('unsignedGroup' in result)) throw new Error('expected compose result')
    const [t1, t2] = result.unsignedGroup.map((b) =>
      algosdk.decodeUnsignedTransaction(base64ToBytes(b)),
    )
    expect(t1!.group).toBeDefined()
    expect(t1!.group).toEqual(t2!.group)
  })

  test('ABI method call via signature, with txn arg and extraFee', async () => {
    const built = await buildGroup(fakeCtx(), [
      {
        type: 'app_call',
        sender: ADDR_A,
        appId: 999,
        methodSignature: 'optInToAsset(pay,uint64)void',
        args: [{ type: 'pay', receiver: ADDR_B, amount: 200000 }, 1659],
        extraFee: 2000,
      },
    ])
    expect(built.methodIndexes).toEqual([0])
    const group = built.atc.buildGroup()
    expect(group).toHaveLength(2) // txn arg + app call
    const appCall = group[1]!.txn
    expect(appCall.fee).toBe(BigInt(3000)) // minFee 1000 + extraFee 2000
  })

  test('auto-populates box references from a simulate probe', async () => {
    const boxName = new TextEncoder().encode('msggreeting1')
    // Fake algod whose simulate reports one unnamed box the call touched.
    const ctx = fakeCtx({
      algod: {
        getTransactionParams: () => ({ do: async () => suggestedParams }),
        simulateTransactions: () => ({
          do: async () => ({
            version: 2,
            lastRound: 1,
            txnGroups: [
              {
                txnResults: [
                  {
                    txnResult: { txn: {} },
                    unnamedResourcesAccessed: {
                      boxes: [new algosdk.modelsv2.BoxReference({ app: 0, name: boxName })],
                    },
                  },
                ],
              },
            ],
          }),
        }),
      } as unknown as ToolContext['algod'],
    })
    const result = (await composeOrExecute(ctx, [
      {
        type: 'app_call',
        sender: ADDR_A,
        appId: 1244,
        methodSignature: 'storeMessage(string,string)void',
        args: ['greeting1', 'hi'],
      },
    ])) as { unsignedGroup: string[] }
    const txn = algosdk.decodeUnsignedTransaction(base64ToBytes(result.unsignedGroup[0]!))
    expect(txn.applicationCall?.boxes?.some((b) => b.name.length === boxName.length)).toBe(true)
  })

  test('attaches populated box/foreign references to an app-call txn', async () => {
    const boxName = new TextEncoder().encode('msggreeting1')
    const built = await buildGroup(
      fakeCtx(),
      [
        {
          type: 'app_call',
          sender: ADDR_A,
          appId: 1244,
          methodSignature: 'storeMessage(string,string)void',
          args: ['greeting1', 'hi'],
        },
      ],
      new Map([[0, { boxes: [{ appIndex: 0, name: boxName }], foreignAssets: [31566704] }]]),
    )
    const txn = built.atc.buildGroup()[0]!.txn
    // The box the method opens is now declared on the transaction.
    expect(txn.applicationCall?.boxes?.some((b) => b.name.length === boxName.length)).toBe(true)
    expect(txn.applicationCall?.foreignAssets?.map(Number)).toContain(31566704)
  })

  test('maxFee caps extraFee', async () => {
    const built = await buildGroup(fakeCtx(), [
      {
        type: 'app_call',
        sender: ADDR_A,
        appId: 999,
        methodSignature: 'noop()void',
        extraFee: 50_000,
        maxFee: 2000,
      },
    ])
    expect(built.atc.buildGroup()[0]!.txn.fee).toBe(BigInt(2000))
  })

  test('asset_opt_out checks balance and throws on nonzero holdings', async () => {
    const ctx = fakeCtx({
      algod: {
        getTransactionParams: () => ({ do: async () => suggestedParams }),
        accountAssetInformation: () => ({
          do: async () => ({ assetHolding: { amount: BigInt(7) } }),
        }),
      } as unknown as ToolContext['algod'],
    })
    await expect(
      composeOrExecute(ctx, [
        { type: 'asset_opt_out', sender: ADDR_A, assetId: 5, closeAssetTo: ADDR_B },
      ]),
    ).rejects.toThrow(/opting out would forfeit/)
  })

  test('invalid sender throws ToolError, group size validated', async () => {
    await expect(
      composeOrExecute(fakeCtx(), [
        { type: 'payment', sender: 'nope', receiver: ADDR_B, amountMicroAlgos: 1 },
      ]),
    ).rejects.toThrow(ToolError)
    await expect(composeOrExecute(fakeCtx(), [])).rejects.toThrow(/1-16/)
  })

  test('execute mode without resolveSigner throws NO_SIGNER', async () => {
    await expect(
      composeOrExecute(fakeCtx({ mode: 'execute' }), [
        { type: 'payment', sender: ADDR_A, receiver: ADDR_B, amountMicroAlgos: 1 },
      ]),
    ).rejects.toThrow(/no signer configured/)
  })
})

describe('resolveAbiMethod', () => {
  test('resolves from app spec method list', () => {
    const appSpec = JSON.stringify({
      contract: {
        methods: [{ name: 'hello', args: [{ type: 'string' }], returns: { type: 'string' } }],
      },
    })
    const method = resolveAbiMethod({ appSpec, method: 'hello' }, 0)
    expect(method?.getSignature()).toBe('hello(string)string')
  })

  test('throws METHOD_NOT_FOUND for missing method, INVALID_APP_SPEC for bad JSON', () => {
    const appSpec = JSON.stringify({ methods: [] })
    expect(() => resolveAbiMethod({ appSpec, method: 'nope' }, 0)).toThrow(/not found/)
    expect(() => resolveAbiMethod({ appSpec: '{bad', method: 'x' }, 0)).toThrow(/not valid JSON/)
  })

  test('returns undefined when no method info supplied (plain app call)', () => {
    expect(resolveAbiMethod({}, 0)).toBeUndefined()
  })
})

describe('simulateGroup', () => {
  test('shapes simulate response: success, logs, budgets, returns', async () => {
    const simulateResponse = {
      lastRound: BigInt(500),
      txnGroups: [
        {
          failureMessage: undefined,
          failedAt: undefined,
          appBudgetAdded: BigInt(700),
          appBudgetConsumed: BigInt(30),
          txnResults: [
            {
              txnResult: { logs: [new TextEncoder().encode('hello log')] },
              appBudgetConsumed: BigInt(30),
            },
          ],
        },
      ],
    }
    const ctx = fakeCtx({
      algod: {
        getTransactionParams: () => ({ do: async () => suggestedParams }),
      } as unknown as ToolContext['algod'],
    })
    // Stub the ATC simulate call at the module boundary: patch algod.simulateTransactions
    // is internal to algosdk, so instead patch AtomicTransactionComposer.prototype.simulate.
    const original = algosdk.AtomicTransactionComposer.prototype.simulate
    algosdk.AtomicTransactionComposer.prototype.simulate = async function () {
      return { simulateResponse, methodResults: [] } as never
    }
    try {
      const result = await simulateGroup(ctx, [
        { type: 'payment', sender: ADDR_A, receiver: ADDR_B, amountMicroAlgos: 1 },
      ])
      expect(result.wouldSucceed).toBe(true)
      expect(result.simulatedRound).toBe(500)
      expect(result.transactionResults[0]?.logs).toEqual(['hello log'])
      expect(result.appBudgetAdded).toBe(700)
    } finally {
      algosdk.AtomicTransactionComposer.prototype.simulate = original
    }
  })
})

describe('close/clear confirmations (adversarial review item 5)', () => {
  test('closeRemainderTo without confirmCloseAccount is rejected', async () => {
    const { buildGroup } = await import('../../src/core/compose/build.js')
    const ctx = fakeCtx()
    expect(
      buildGroup(ctx, [
        {
          type: 'payment',
          sender: ADDR_A,
          receiver: ADDR_B,
          amountMicroAlgos: 1,
          closeRemainderTo: ADDR_B,
        },
      ]),
    ).rejects.toMatchObject({ code: 'CLOSE_NOT_CONFIRMED' })
  })

  test('closeRemainderTo with confirmCloseAccount builds', async () => {
    const { buildGroup } = await import('../../src/core/compose/build.js')
    const ctx = fakeCtx()
    const built = await buildGroup(ctx, [
      {
        type: 'payment',
        sender: ADDR_A,
        receiver: ADDR_B,
        amountMicroAlgos: 1,
        closeRemainderTo: ADDR_B,
        confirmCloseAccount: true,
      },
    ])
    expect(built.atc.buildGroup()).toHaveLength(1)
  })

  test('asset_config keeps strict empty-address checking unless confirmClearRoles', async () => {
    const { buildGroup } = await import('../../src/core/compose/build.js')
    const ctx = fakeCtx()
    // omitting roles without confirmation → algosdk strict check throws
    expect(
      buildGroup(ctx, [{ type: 'asset_config', sender: ADDR_A, assetId: 1, manager: ADDR_A }]),
    ).rejects.toThrow()
    // with explicit confirmation the clear is allowed
    const built = await buildGroup(ctx, [
      {
        type: 'asset_config',
        sender: ADDR_A,
        assetId: 1,
        manager: ADDR_A,
        confirmClearRoles: true,
      },
    ])
    expect(built.atc.buildGroup()).toHaveLength(1)
  })
})

describe('ABI-embedded acfg is not a silent role-clear bypass (review item 5 follow-up)', () => {
  test('acfg inside an app_call ABI arg keeps strict checking unless confirmed', async () => {
    const { buildGroup } = await import('../../src/core/compose/build.js')
    const ctx = fakeCtx()
    // an acfg smuggled as a transaction-typed ABI arg, omitting roles → must throw
    const specWithInnerClear: TxnSpec = {
      type: 'app_call',
      sender: ADDR_A,
      appId: 123,
      methodSignature: 'configure(acfg)void',
      args: [{ type: 'acfg', sender: ADDR_A, assetId: 1, manager: ADDR_A }],
    }
    expect(buildGroup(ctx, [specWithInnerClear])).rejects.toThrow()

    // with explicit confirmation the inner clear is allowed
    const confirmed: TxnSpec = {
      type: 'app_call',
      sender: ADDR_A,
      appId: 123,
      methodSignature: 'configure(acfg)void',
      args: [
        { type: 'acfg', sender: ADDR_A, assetId: 1, manager: ADDR_A, confirmClearRoles: true },
      ],
    }
    const built = await buildGroup(ctx, [confirmed])
    expect(built.atc.buildGroup().length).toBeGreaterThanOrEqual(1)
  })
})
