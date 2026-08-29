import { describe, expect, test } from 'bun:test'
import algosdk from 'algosdk'

import { base64ToBytes, resolveNetwork } from '../../../src/core/index.js'
import {
  getHaystack,
  haystackPlugin,
  haystackTools,
  toBaseUnits,
} from '../../../src/plugins/haystack/index.js'
import { fakeContext } from '../../tools/fake-context.js'

const params: algosdk.SuggestedParams = {
  fee: 1000,
  firstValid: 1,
  lastValid: 1001,
  genesisID: 'test',
  genesisHash: new Uint8Array(32),
  minFee: 1000,
}
const user = algosdk.generateAccount()
const router = algosdk.generateAccount()

const quote = {
  quote: '2310000',
  flattenedRoute: { 'Tinyman V2': 60, Pact: 40 },
  userPriceImpact: 0.12,
  usdIn: 1.0,
  usdOut: 0.99,
}

function ctxWith(service: unknown, mode: 'compose' | 'execute' = 'compose') {
  const ctx = fakeContext({
    mode,
    services: { haystack: service },
    algod: {
      getAssetByID: () => ({ do: async () => ({ params: { decimals: 6, unitName: 'USDC' } }) }),
    },
  })
  ctx.network = resolveNetwork('mainnet')
  return ctx
}

describe('haystack plugin', () => {
  test('exports a quote read and a swap write, both with schemas and views', () => {
    expect(haystackTools.map((t) => t.name)).toEqual(['get_swap_quote', 'swap'])
    expect(haystackTools[0]!.requiresSigner ?? false).toBe(false)
    expect(haystackTools[1]!.requiresSigner).toBe(true)
    for (const tool of haystackTools) expect(tool.description.length).toBeLessThanOrEqual(200)
    expect(Object.keys(haystackPlugin({ apiKey: 'k' }).views ?? {})).toEqual(['haystack.quote'])
  })

  test('mainnet-only and unregistered guards throw ToolErrors', () => {
    expect(() => getHaystack(fakeContext({}))).toThrow('not registered')
    const localnet = fakeContext({
      services: { haystack: haystackPlugin({ apiKey: 'k' }).service },
    })
    expect(() => getHaystack(localnet)).toThrow('mainnet only')
  })

  test('toBaseUnits scales plain decimals and refuses too many fraction digits', () => {
    expect(toBaseUnits('10', 6)).toBe(10_000_000n)
    expect(toBaseUnits('2.5', 6)).toBe(2_500_000n)
    expect(toBaseUnits('7', 0)).toBe(7n)
    expect(() => toBaseUnits('1.1234567', 6)).toThrow('more than 6 decimals')
    expect(() => toBaseUnits('ten', 6)).toThrow('not a plain decimal')
  })

  test('get_swap_quote scales the amount, maps the route, and reports the opt-in', async () => {
    let captured: Record<string, unknown> | undefined
    const service = {
      routerFor: () => ({
        newQuote: async (args: Record<string, unknown>) => {
          captured = args
          return quote
        },
        needsAssetOptIn: async () => true,
      }),
    }
    const result = (await haystackTools[0]!.handler(ctxWith(service), {
      fromAssetId: 0,
      toAssetId: 31566704,
      amount: '10',
      sender: user.addr.toString(),
    })) as Record<string, unknown>
    expect(captured?.amount).toBe(10_000_000n)
    expect(result).toMatchObject({
      fromUnit: 'ALGO',
      toUnit: 'USDC',
      amountIn: '10000000',
      amountOut: '2310000',
      route: [
        { venue: 'Tinyman V2', percentage: 60 },
        { venue: 'Pact', percentage: 40 },
      ],
      priceImpactPercent: 0.12,
      needsOptIn: true,
    })
  })

  test('swap composes the group: the router leg arrives signed, the user leg stays unsigned', async () => {
    const userLeg = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: user.addr,
      receiver: router.addr,
      amount: 10_000_000,
      suggestedParams: params,
    })
    const routerLeg = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: router.addr,
      receiver: user.addr,
      amount: 2_310_000,
      suggestedParams: params,
    })
    algosdk.assignGroupID([userLeg, routerLeg])
    const service = {
      routerFor: () => ({
        newQuote: async () => quote,
        needsAssetOptIn: async () => false,
        newSwap: async ({ signer }: { signer: algosdk.TransactionSigner }) => ({
          addSwapTransactions: async () => undefined,
          buildGroup: () => [
            { txn: userLeg, signer },
            { txn: routerLeg, signer: algosdk.makeBasicAccountTransactionSigner(router) },
          ],
        }),
      }),
    }
    const result = (await haystackTools[1]!.handler(ctxWith(service), {
      fromAssetId: 0,
      toAssetId: 31566704,
      amount: '10',
      sender: user.addr.toString(),
      slippagePercent: 1,
    })) as {
      unsignedGroup: string[]
      presigned: (string | null)[]
      intent: Record<string, unknown>
      summary: string
    }
    expect(result.unsignedGroup).toHaveLength(2)
    expect(result.presigned[0]).toBeNull()
    const signed = algosdk.decodeSignedTransaction(base64ToBytes(result.presigned[1]!))
    expect(signed.txn.txID()).toBe(routerLeg.txID())
    expect(result.intent).toMatchObject({
      kind: 'swap',
      fromUnit: 'ALGO',
      toUnit: 'USDC',
      amountIn: '10000000',
      amountOut: '2310000',
      minAmountOut: '2286900',
      slippagePercent: 1,
    })
    expect(result.summary).toBe('swap 10 ALGO → 2.31 USDC via Tinyman V2 + Pact')
  })
})
