import { z } from 'zod'

/** Money on this wire is a fixed 6-decimal string, the USDC base unit. */
const usdc = z.string()

export const offerSchema = z.object({
  offerId: z.string(),
  type: z.string(),
  country: z.string(),
  brand: z.string(),
  brandName: z.string().optional(),
  name: z.string().optional(),
  notes: z.string().optional(),
  priceType: z.string().optional(),
  sendCurrency: z.string().optional(),
  sendFixed: z.number().optional(),
  sendMin: z.number().optional(),
  sendMax: z.number().optional(),
  dataGB: z.number().optional(),
  durationDays: z.number().optional(),
  price_usdc_from: usdc.optional(),
})

export const offerListSchema = z.object({
  type: z.string().optional(),
  country: z.string().nullable().optional(),
  offers: z.array(offerSchema),
})

/**
 * The operator is DETECTED from the number range and can be wrong — see the
 * tool description. `confirm_operator` carries the merchant's own warning and
 * is passed through verbatim rather than summarised.
 */
export const phoneLookupSchema = z.object({
  phone: z.string(),
  country: z.string().nullable(),
  brand: z.string().optional(),
  brandName: z.string().optional(),
  offers: z.array(offerSchema).optional(),
  operator_detection: z.string().optional(),
  confirm_operator: z.string().optional(),
  other_brands: z.array(z.object({ brand: z.string(), brandName: z.string() })).optional(),
})

export const quoteSchema = z.object({
  quoteId: z.string(),
  type: z.string(),
  offer: z.object({ id: z.string(), name: z.string(), brand: z.string(), country: z.string() }).partial(),
  delivers: z.string().optional(),
  price_usdc: usdc,
  expires_at: z.string(),
  pay: z.object({ method: z.string(), endpoint: z.string() }).partial().optional(),
})

/**
 * What `buy` returns. This plugin holds no wallet, so the answer is a payment
 * challenge for the agent's own signer, never a settled order.
 */
export const paymentChallengeSchema = z.object({
  http_status: z.number(),
  payment_required: z.unknown().optional(),
  quote: z.unknown().optional(),
  how_to_pay: z.string().optional(),
  error: z.string().optional(),
})

export const orderSchema = z.object({
  orderId: z.string(),
  status: z.string(),
  type: z.string().optional(),
  country: z.string().optional(),
  brand: z.string().optional(),
  price_usdc: usdc.optional(),
  payer: z.string().optional(),
  settlement_txid: z.string().optional(),
  settlement_url: z.string().optional(),
  confirmation: z.unknown().optional(),
  receipt: z.unknown().optional(),
  refund_txid: z.string().optional(),
  refund_url: z.string().optional(),
  error: z.string().optional(),
  terminal: z.boolean().optional(),
  status_url: z.string().optional(),
})

export const receiptCheckSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
  signer: z.string().optional(),
  settlement_txid: z.string().optional(),
  refund_txid: z.string().nullable().optional(),
  explorer: z.string().optional(),
})

export const fxSchema = z.object({
  from: z.string(),
  to: z.string(),
  rate: z.number(),
  inverse_usdc_per_unit: z.number().optional(),
  amount_local: z.number().optional(),
  estimate_usdc: usdc.optional(),
  note: z.string().optional(),
  as_of: z.string().optional(),
})

/**
 * The merchant's public delivery record. `stranded` is the number worth
 * reading: payers who were charged, received nothing, and whose refund also
 * failed. A merchant that publishes it is making a checkable claim.
 */
export const ledgerSchema = z.object({
  network: z.string().optional(),
  orders: z.number(),
  delivered: z.number(),
  refunded: z.number(),
  in_flight: z.number().optional(),
  stranded: z.number().optional(),
  delivered_or_refunded_pct: z.number().nullable().optional(),
  volume_usdc: usdc.optional(),
  countries: z.array(z.object({ country: z.string(), orders: z.number(), volume_usdc: usdc })).optional(),
  types: z.array(z.object({ type: z.string(), orders: z.number(), volume_usdc: usdc })).optional(),
})

export type Offer = z.infer<typeof offerSchema>
export type Quote = z.infer<typeof quoteSchema>
export type Order = z.infer<typeof orderSchema>
