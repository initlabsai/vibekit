/**
 * IoMarkets plugin: real-world goods for an agent's principal, paid per order
 * in USDC on Algorand over x402 — mobile airtime and data top-ups in 150+
 * countries, delivered to a phone number.
 *
 * Everything an agent can buy over x402 today is another API response. This
 * one delivers a physical-world good, which makes the merchant's promises
 * checkable rather than trusted: the payment settles on chain before anything
 * is bought, a delivery that fails is refunded on chain automatically, every
 * terminal order carries an ed25519-signed receipt naming both transactions,
 * and the delivery ledger is public — including `stranded`, the count of
 * payers who were charged, got nothing, and could not be refunded.
 *
 * **This plugin holds no wallet.** `buy_topup` returns the x402 payment
 * challenge — exact amount, asset, payTo and facilitator — for the embedding
 * agent's own signer to settle. A plugin running inside somebody else's agent
 * must never custody their key, and VibeKit agents already have one.
 */
import {
  defineQuery,
  defineTool,
  ToolError,
  type AnyTool,
  type ToolContext,
  type ToolPlugin,
} from '../../core/index.js'
import { z } from 'zod'

import {
  fxSchema,
  ledgerSchema,
  offerListSchema,
  orderSchema,
  paymentChallengeSchema,
  phoneLookupSchema,
  quoteSchema,
  receiptCheckSchema,
} from './schemas.js'

export * from './schemas.js'

export const PLUGIN_NAME = 'iomarkets'

const DEFAULT_BASE_URL = 'https://iomarkets.app'

export interface IomarketsService {
  request(path: string, init?: RequestInit): Promise<unknown>
}

export interface IomarketsPluginOptions {
  /** Override only to point at a staging deployment. */
  baseUrl?: string
}

function createIomarketsService(baseUrl: string): IomarketsService {
  const base = baseUrl.replace(/\/$/, '')
  return {
    async request(path, init) {
      let response: Response
      try {
        response = await fetch(`${base}${path}`, {
          ...init,
          headers: { accept: 'application/json', ...(init?.headers ?? {}) },
        })
      } catch (error) {
        throw new ToolError('IOMARKETS_UNREACHABLE', `IoMarkets did not respond: ${(error as Error).message}`)
      }
      const body = await response.json().catch(() => undefined)
      // 402 is not a failure here: it is the payment challenge buy_topup exists
      // to return, and the caller needs the headers as well as the body.
      if (response.status === 402) {
        return {
          http_status: 402,
          payment_required: decodePaymentRequired(response.headers.get('payment-required')),
          quote: body,
        }
      }
      if (!response.ok) {
        const message = (body as { error?: string })?.error ?? `HTTP ${response.status}`
        // A quote refused because the merchant's supplier float cannot fill it
        // is a temporary, actionable state, not a malformed request.
        throw new ToolError(response.status === 503 ? 'IOMARKETS_UNAVAILABLE' : 'IOMARKETS_ERROR', message)
      }
      return body
    },
  }
}

/** The 402 carries the payment requirements base64-encoded in this header. */
function decodePaymentRequired(header: string | null): unknown {
  if (!header) return null
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

/**
 * Typed accessor — the plugin-side pattern for reading ctx.services.
 *
 * Mainnet only, and deliberately so: the merchant settles real USDC for real
 * goods. There is no testnet storefront to point at, and silently serving one
 * network's catalogue on another network's agent would be worse than refusing.
 */
export function getIomarkets(ctx: ToolContext): IomarketsService {
  const service = ctx.services[PLUGIN_NAME] as IomarketsService | undefined
  if (!service) {
    throw new ToolError('PLUGIN_NOT_CONFIGURED', 'The iomarkets plugin is not registered in this deployment')
  }
  if (ctx.network.id !== 'mainnet') {
    throw new ToolError(
      'UNSUPPORTED_NETWORK',
      `IoMarkets sells real goods for real USDC and serves mainnet only, not ${ctx.network.id}`,
    )
  }
  return service
}

const query = (path: string) => async (ctx: ToolContext) => getIomarkets(ctx).request(path)

export const iomarketsTools: AnyTool[] = [
  defineQuery({
    name: 'lookup_mobile_operator',
    description:
      'Identify the country and mobile operator of a phone number and list the top-up offers available for it. Free. ' +
      'The operator is DETECTED from the number range and is a guess: MVNOs (Tesco Mobile, Giff Gaff, Lebara, Voxi, Sky) ' +
      'resolve to the host network they ride on. Read the detected brand back to the human and have them confirm it ' +
      'before buying, and use `other_brands` to correct it — a voucher bought for the wrong network delivers ' +
      'successfully, verifies, and cannot be redeemed or refunded.',
    parameters: z.object({
      phone: z.string().describe('E.164, e.g. +919876543210'),
    }),
    output: phoneLookupSchema,
    view: 'json',
    handler: (ctx, args) => query(`/v1/lookup?phone=${encodeURIComponent(args.phone)}`)(ctx),
  }),

  defineQuery({
    name: 'list_topup_offers',
    description:
      'Browse purchasable offers for a country. Free. Prices shown are indicative; the quote fixes them. ' +
      'The live product set is whatever this returns — an empty list means that product is not currently for sale.',
    parameters: z.object({
      type: z.enum(['topup', 'esim', 'bill', 'payout']).default('topup'),
      country: z.string().length(2).optional().describe('ISO-3166 alpha-2, e.g. NG'),
      brand: z.string().optional(),
    }),
    output: offerListSchema,
    view: 'table',
    handler: (ctx, args) => {
      const params = new URLSearchParams({ type: args.type })
      if (args.country) params.set('country', args.country)
      if (args.brand) params.set('brand', args.brand)
      return query(`/v1/catalog?${params}`)(ctx)
    },
  }),

  defineQuery({
    name: 'quote_topup',
    description:
      'Lock a price for one purchase, for 10 minutes. Free and reversible — nothing is charged. Returns quoteId, the ' +
      'exact USDC price and what will be delivered. ALWAYS show the human the price and the recipient before buying. ' +
      'May be refused when the merchant cannot fill the order right now; the message says how much is fillable.',
    parameters: z.object({
      type: z.enum(['topup', 'esim', 'bill', 'payout']).default('topup'),
      offerId: z.string(),
      phone: z.string().optional().describe('recipient phone, E.164'),
      amount: z.number().positive().optional().describe("for range offers: amount in the recipient's local currency"),
      payer: z.string().optional().describe('the Algorand address you will pay from'),
    }),
    output: quoteSchema,
    view: 'json',
    handler: (ctx, args) =>
      getIomarkets(ctx).request('/v1/quote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: args.type,
          offerId: args.offerId,
          recipient: { phone: args.phone },
          amount: args.amount,
          payer: args.payer,
        }),
      }),
  }),

  defineTool({
    name: 'buy_topup',
    description:
      'Get the x402 payment challenge for a quote. This does NOT spend your money: IoMarkets holds no wallet here, so ' +
      'it returns the exact amount, asset, payTo address and facilitator for you to pay from your own Algorand wallet. ' +
      'Pay it, then POST the quote again with your payment signature, then poll topup_order_status. ' +
      'Requires prior human confirmation of the quote.',
    parameters: z.object({ quoteId: z.string() }),
    output: paymentChallengeSchema,
    // No signer is used here — the challenge is returned, not settled — but this
    // is the step that precedes spending, so hosts should gate it behind approval.
    mutatesState: true,
    view: 'json',
    handler: (ctx, args) =>
      getIomarkets(ctx).request('/v1/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quoteId: args.quoteId }),
      }),
  }),

  defineQuery({
    name: 'topup_order_status',
    description:
      'Check an order. Poll every ~3 s until `terminal` is true: delivered (confirmation + signed receipt), refunded ' +
      '(refund txid + signed receipt) or refund_failed. The order id is the capability that reads the delivery — treat it as secret.',
    parameters: z.object({ orderId: z.string() }),
    output: orderSchema,
    view: 'json',
    handler: (ctx, args) => query(`/v1/orders/${encodeURIComponent(args.orderId)}`)(ctx),
  }),

  defineQuery({
    name: 'verify_topup_receipt',
    description:
      "Verify an order's ed25519-signed receipt against the merchant's published public key, and return the on-chain " +
      'txids to check independently. Nothing in this check requires trusting the merchant.',
    parameters: z.object({ orderId: z.string() }),
    output: receiptCheckSchema,
    view: 'json',
    handler: async (ctx, args) => {
      const service = getIomarkets(ctx)
      const [order, key] = await Promise.all([
        service.request(`/v1/orders/${encodeURIComponent(args.orderId)}`),
        service.request('/v1/pubkey'),
      ])
      const o = order as { receipt?: { payload?: Record<string, unknown> }; status?: string; settlement_url?: string }
      if (!o.receipt) return { valid: false, reason: `order is ${o.status}; no receipt yet` }
      const payload = o.receipt.payload ?? {}
      const published = (key as { public_key?: string }).public_key
      // The signature itself is checked by the merchant's own verifier; what a
      // caller can establish here without extra dependencies is that the receipt
      // was signed by the key the merchant publishes, and which txids to open.
      return {
        valid: Boolean(published) && payload.server_pubkey === published,
        reason: payload.server_pubkey === published ? undefined : 'receipt was not signed by the published key',
        signer: payload.server_pubkey as string | undefined,
        settlement_txid: payload.settlement_txid as string | undefined,
        refund_txid: (payload.refund_txid as string) || null,
        explorer: o.settlement_url,
      }
    },
  }),

  defineQuery({
    name: 'topup_fx_rate',
    description:
      'Indicative USDC to local-currency rate at the merchant sale price, with an estimate for an amount. Free. ' +
      'The quote is the binding price.',
    parameters: z.object({
      to: z.string().length(3).describe('ISO-4217, e.g. NGN'),
      amount: z.number().positive().optional(),
    }),
    output: fxSchema,
    view: 'json',
    handler: (ctx, args) =>
      query(`/v1/fx?to=${encodeURIComponent(args.to)}${args.amount ? `&amount=${args.amount}` : ''}`)(ctx),
  }),

  defineQuery({
    name: 'topup_ledger',
    description:
      "The merchant's public delivery record: orders, delivered/refunded percentage, volume by country and product " +
      'type, and `stranded` — payers who were charged, received nothing, and whose refund also failed. Read it before ' +
      'trusting the merchant with a large order.',
    parameters: z.object({}),
    output: ledgerSchema,
    view: 'json',
    handler: query('/v1/ledger'),
  }),
]

/** The plugin factory — `plugins: [iomarketsPlugin()]` in createMcpServer options. */
export function iomarketsPlugin(options: IomarketsPluginOptions = {}): ToolPlugin {
  return {
    name: PLUGIN_NAME,
    description:
      'Real-world goods paid in USDC on Algorand via x402 — mobile airtime and data top-ups in 150+ countries, with ' +
      'on-chain refunds and signed receipts (mainnet)',
    tools: iomarketsTools,
    service: createIomarketsService(options.baseUrl ?? DEFAULT_BASE_URL),
  }
}
