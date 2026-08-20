import { z } from 'zod'

/** Formatted transaction returned by handlers. */
export interface FormattedTransaction {
  /** Absent on inner transactions — the indexer assigns them no id. */
  id?: string
  type?: string
  sender: string
  /** microALGOs; decimal string when the uint64 exceeds 2^53. */
  feeMicroAlgos: number | string
  confirmedRound?: number
  roundTime?: number
  /** microALGOs; decimal string when the uint64 exceeds 2^53. */
  paymentAmountMicroAlgos?: number | string
  receiver?: string
  assetId?: number
  /** Base units; decimal string when the uint64 exceeds 2^53. */
  assetAmount?: number | string
  assetName?: string
  assetUnitName?: string
  assetDecimals?: number
  applicationId?: number
  onCompletion?: string
  note?: string
  group?: string
  rekeyTo?: string
  closeTo?: string
  /** Pay close-out amount in microALGOs; decimal string above 2^53. */
  closeAmountMicroAlgos?: number | string
  /** Axfer close-out amount in base units; decimal string above 2^53. */
  closeAssetAmount?: number | string
  clawbackFrom?: string
  innerTxns?: FormattedTransaction[]
  globalStateDelta?: unknown
  localStateDelta?: unknown
  logs?: string[]
}

/** Post-jsonSafe wire shape of {@link FormattedTransaction}. */
export const formattedTransactionSchema = z.object({
  // The indexer assigns no id to inner transactions, and txType is optional
  // in the indexer model — both keys are absent when unset (jsonSafe drops
  // undefined entries).
  id: z.string().optional(),
  type: z.string().optional(),
  sender: z.string(),
  feeMicroAlgos: z
    .union([z.number(), z.string()])
    .describe('Fee in microALGOs (1 ALGO = 1,000,000 microALGOs); decimal string when above 2^53'),
  confirmedRound: z.number().optional(),
  roundTime: z.number().optional(),
  paymentAmountMicroAlgos: z
    .union([z.number(), z.string()])
    .optional()
    .describe(
      'Payment amount in microALGOs (1 ALGO = 1,000,000 microALGOs); decimal string when above 2^53',
    ),
  receiver: z.string().optional(),
  assetId: z.number().optional(),
  assetAmount: z
    .union([z.number(), z.string()])
    .optional()
    .describe('Asset amount in base units; decimal string when above 2^53'),
  applicationId: z.number().optional(),
  onCompletion: z.string().optional(),
  assetName: z.string().optional(),
  assetUnitName: z.string().optional(),
  assetDecimals: z.number().int().nonnegative().optional(),
  rekeyTo: z.string().optional(),
  closeTo: z.string().optional(),
  closeAmountMicroAlgos: z
    .union([z.number(), z.string()])
    .optional()
    .describe(
      'Pay close-out amount in microALGOs (1 ALGO = 1,000,000 microALGOs); decimal string when above 2^53',
    ),
  closeAssetAmount: z
    .union([z.number(), z.string()])
    .optional()
    .describe('Axfer close-out amount in base units; decimal string when above 2^53'),
  clawbackFrom: z.string().optional(),
  note: z.string().optional(),
  group: z.string().optional(),
  get innerTxns() {
    return z.array(formattedTransactionSchema).optional()
  },
  globalStateDelta: z.unknown().optional(),
  localStateDelta: z.unknown().optional(),
  logs: z.array(z.string()).optional(),
})

/** Wire shape of every transaction-list tool result ('transaction.list' view). */
export const transactionListSchema = z.object({
  transactions: z.array(formattedTransactionSchema),
  nextToken: z.string().optional(),
})
