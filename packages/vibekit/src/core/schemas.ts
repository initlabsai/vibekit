/** Shared zod schemas for write-tool outputs (compose | execute result union). */
import { z } from 'zod'

export const swapIntentSchema = z.object({
  kind: z.literal('swap'),
  fromAssetId: z.number(),
  toAssetId: z.number(),
  fromUnit: z.string(),
  toUnit: z.string(),
  fromDecimals: z.number(),
  toDecimals: z.number(),
  amountIn: z.string(),
  amountOut: z.string(),
  minAmountOut: z.string(),
  slippagePercent: z.number(),
  priceImpactPercent: z.number().optional(),
  usdIn: z.number().optional(),
  usdOut: z.number().optional(),
  route: z.array(z.object({ venue: z.string(), percentage: z.number() })),
})

export const orderIntentSchema = z.object({
  kind: z.literal('order'),
  marketAppId: z.number(),
  title: z.string().optional(),
  side: z.enum(['yes', 'no']),
  action: z.enum(['buy', 'sell']),
  orderType: z.enum(['limit', 'market']),
  priceUsd: z.number(),
  quantity: z.number(),
  totalUsd: z.number(),
  slippagePercent: z.number().optional(),
})

/** What a write intends, when a host can say it better than a transaction list. */
export const writeIntentSchema = z.discriminatedUnion('kind', [swapIntentSchema, orderIntentSchema])

export const unsignedGroupResultSchema = z.object({
  unsignedGroup: z.array(z.string()).describe('base64-encoded unsigned transactions, group order'),
  summary: z.string(),
  presigned: z
    .array(z.string().nullable())
    .optional()
    .describe(
      'per index: a base64 signed txn another party signed, or null where the wallet signs',
    ),
  intent: writeIntentSchema.optional(),
})

export const executeGroupResultSchema = z.object({
  txids: z.array(z.string()),
  confirmedRound: z.number(),
  // nullish: zod 4 treats a bare z.unknown() field as a required key, and
  // jsonSafe drops undefined entries — absent-or-null must both validate.
  returns: z.array(z.object({ index: z.number(), value: z.unknown().nullish() })),
})

/** What every action returns: unsigned group (compose mode) or execution result. */
export const writeResultSchema = z.union([unsignedGroupResultSchema, executeGroupResultSchema])
