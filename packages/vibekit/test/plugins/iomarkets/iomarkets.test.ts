import { describe, expect, test } from 'bun:test'
import { resolveNetwork, type NetworkId } from '../../../src/core/index.js'
import {
  getIomarkets,
  iomarketsPlugin,
  iomarketsTools,
  type IomarketsService,
} from '../../../src/plugins/iomarkets/index.js'

const ctxFor = (network: NetworkId, service?: unknown) =>
  ({ network: resolveNetwork(network), services: service ? { iomarkets: service } : {} }) as never

/** Records the calls a tool makes and answers with a canned body. */
const stub = (answer: unknown, seen: Array<{ path: string; init?: RequestInit }> = []): IomarketsService => ({
  async request(path, init) {
    seen.push({ path, init })
    return answer
  },
})

const toolNamed = (name: string) => iomarketsTools.find((t) => t.name === name)!

describe('iomarkets plugin', () => {
  test('exports 8 tools, each with an output schema and a view', () => {
    expect(iomarketsTools.map((t) => t.name)).toEqual([
      'lookup_mobile_operator',
      'list_topup_offers',
      'quote_topup',
      'buy_topup',
      'topup_order_status',
      'verify_topup_receipt',
      'topup_fx_rate',
      'topup_ledger',
    ])
    for (const tool of iomarketsTools) {
      expect(tool.output).toBeDefined()
      expect(tool.view).toBeDefined()
      // The plugin holds no wallet, so nothing here may claim a signer.
      expect(tool.requiresSigner ?? false).toBe(false)
    }
  })

  test('only buy_topup is approval-gated — it is the step before spending', () => {
    for (const tool of iomarketsTools) {
      expect(tool.mutatesState ?? false).toBe(tool.name === 'buy_topup')
    }
  })

  test('network and registration guards throw ToolErrors', () => {
    expect(() => getIomarkets(ctxFor('mainnet'))).toThrow('not registered')
    // Real goods for real USDC: there is no testnet storefront to serve.
    expect(() => getIomarkets(ctxFor('testnet', iomarketsPlugin().service))).toThrow('mainnet only')
    expect(() => getIomarkets(ctxFor('localnet', iomarketsPlugin().service))).toThrow('mainnet only')
  })

  test('lookup passes the merchant MVNO warning through verbatim', async () => {
    const seen: Array<{ path: string }> = []
    const warning =
      'The operator was detected from the number range and is a guess. MVNOs are detected as the host network they ride on.'
    const service = stub({ phone: '+447851729650', country: 'GB', confirm_operator: warning }, seen)
    const result = await toolNamed('lookup_mobile_operator').handler(ctxFor('mainnet', service), {
      phone: '+447851729650',
    })
    expect(seen[0]!.path).toBe('/v1/lookup?phone=%2B447851729650')
    // Summarising this warning would lose the part that costs money: a voucher
    // bought for the wrong network delivers, verifies, and cannot be refunded.
    expect((result as { confirm_operator: string }).confirm_operator).toBe(warning)
  })

  test('catalogue query builds the documented params', async () => {
    const seen: Array<{ path: string }> = []
    await toolNamed('list_topup_offers').handler(ctxFor('mainnet', stub({ offers: [] }, seen)), {
      type: 'topup',
      country: 'NG',
    })
    expect(seen[0]!.path).toBe('/v1/catalog?type=topup&country=NG')
  })

  test('quote posts the recipient and payer', async () => {
    const seen: Array<{ path: string; init?: RequestInit }> = []
    await toolNamed('quote_topup').handler(ctxFor('mainnet', stub({ quoteId: 'q_1' }, seen)), {
      type: 'topup',
      offerId: 'rl-123',
      phone: '+2348012345678',
      amount: 500,
      payer: 'PAYER',
    })
    expect(seen[0]!.path).toBe('/v1/quote')
    expect(JSON.parse(String(seen[0]!.init!.body))).toEqual({
      type: 'topup',
      offerId: 'rl-123',
      recipient: { phone: '+2348012345678' },
      amount: 500,
      payer: 'PAYER',
    })
  })

  test('buy returns a payment challenge rather than settling anything', async () => {
    const seen: Array<{ path: string; init?: RequestInit }> = []
    const challenge = { http_status: 402, payment_required: { accepts: [{ payTo: 'MERCHANT' }] } }
    const result = await toolNamed('buy_topup').handler(ctxFor('mainnet', stub(challenge, seen)), {
      quoteId: 'q_1',
    })
    expect(seen[0]!.path).toBe('/v1/orders')
    expect(result).toEqual(challenge)
  })

  test('receipt check compares the signer against the published key', async () => {
    const good: IomarketsService = {
      async request(path) {
        if (path === '/v1/pubkey') return { public_key: 'PUB' }
        return { status: 'delivered', settlement_url: 'https://lora/tx', receipt: { payload: { server_pubkey: 'PUB', settlement_txid: 'TX', refund_txid: '' } } }
      },
    }
    expect(await toolNamed('verify_topup_receipt').handler(ctxFor('mainnet', good), { orderId: 'ord_1' })).toEqual({
      valid: true,
      reason: undefined,
      signer: 'PUB',
      settlement_txid: 'TX',
      refund_txid: null,
      explorer: 'https://lora/tx',
    })
  })

  test('a receipt signed by another key is not valid', async () => {
    const forged: IomarketsService = {
      async request(path) {
        if (path === '/v1/pubkey') return { public_key: 'PUB' }
        return { status: 'delivered', receipt: { payload: { server_pubkey: 'SOMEONE_ELSE' } } }
      },
    }
    const result = await toolNamed('verify_topup_receipt').handler(ctxFor('mainnet', forged), { orderId: 'ord_1' })
    expect((result as { valid: boolean }).valid).toBe(false)
  })

  test('an order with no receipt yet is reported, not treated as invalid signing', async () => {
    const pending: IomarketsService = {
      async request(path) {
        return path === '/v1/pubkey' ? { public_key: 'PUB' } : { status: 'paid' }
      },
    }
    const result = await toolNamed('verify_topup_receipt').handler(ctxFor('mainnet', pending), { orderId: 'ord_1' })
    expect(result).toEqual({ valid: false, reason: 'order is paid; no receipt yet' })
  })

  test('outputs parse against their declared schemas', () => {
    expect(
      toolNamed('topup_ledger').output.safeParse({ orders: 1, delivered: 1, refunded: 0, stranded: 0 }).success,
    ).toBe(true)
    expect(toolNamed('topup_fx_rate').output.safeParse({ from: 'USDC', to: 'NGN', rate: 1450.5 }).success).toBe(true)
  })
})
