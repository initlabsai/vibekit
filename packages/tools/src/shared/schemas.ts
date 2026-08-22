import { z } from 'zod'

/** Asset parameters on an acfg body: present on creates and reconfigures, absent on destroys. */
export interface FormattedAssetConfig {
  /** Total supply in base units; decimal string when the uint64 exceeds 2^53. */
  total?: number | string
  decimals?: number
  unitName?: string
  assetName?: string
  url?: string
  manager?: string
  reserve?: string
  freeze?: string
  clawback?: string
  defaultFrozen?: boolean
}

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
  /** Asset touched by an axfer, acfg, or afrz; 0 on an acfg that creates the asset. */
  assetId?: number
  /** Base units; decimal string when the uint64 exceeds 2^53. */
  assetAmount?: number | string
  assetName?: string
  assetUnitName?: string
  assetDecimals?: number
  applicationId?: number
  onCompletion?: string
  /** Base64 application-args, selector first. Present on ABI method calls. */
  applicationArgs?: string[]
  applicationAccounts?: string[]
  /** Filled when a My Apps spec is known for this applicationId. */
  methodName?: string
  methodArgs?: Array<{ name?: string; type: string; value?: unknown }>
  methodReturn?: unknown
  note?: string
  group?: string
  rekeyTo?: string
  closeTo?: string
  /** Pay close-out amount in microALGOs; decimal string above 2^53. */
  closeAmountMicroAlgos?: number | string
  /** Axfer close-out amount in base units; decimal string above 2^53. */
  closeAssetAmount?: number | string
  clawbackFrom?: string
  /** Afrz target: the account whose asset holding is frozen or thawed. */
  freezeTarget?: string
  /** Afrz new freeze status of the target's holding. */
  frozen?: boolean
  /** Acfg asset parameters; present on creates and reconfigures, absent on destroys. */
  assetConfig?: FormattedAssetConfig
  /** Asset ID assigned when this transaction created an asset. */
  createdAssetId?: number
  /** Application ID assigned when this transaction created an application. */
  createdApplicationId?: number
  /** Signing authority (auth-addr); present only when it differs from the sender. */
  signer?: string
  innerTxns?: FormattedTransaction[]
  globalStateDelta?: unknown
  localStateDelta?: unknown
  logs?: string[]
}

/** Post-jsonSafe wire shape of {@link FormattedAssetConfig}. */
export const formattedAssetConfigSchema = z.object({
  total: z
    .union([z.number(), z.string()])
    .optional()
    .describe('Total supply in base units; decimal string when above 2^53'),
  decimals: z.number().int().nonnegative().optional(),
  unitName: z.string().optional(),
  assetName: z.string().optional(),
  url: z.string().optional(),
  manager: z.string().optional(),
  reserve: z.string().optional(),
  freeze: z.string().optional(),
  clawback: z.string().optional(),
  defaultFrozen: z.boolean().optional(),
})

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
  assetId: z
    .number()
    .optional()
    .describe('Asset touched by an axfer, acfg, or afrz; 0 on an acfg that creates the asset'),
  assetAmount: z
    .union([z.number(), z.string()])
    .optional()
    .describe('Asset amount in base units; decimal string when above 2^53'),
  applicationId: z.number().optional(),
  onCompletion: z.string().optional(),
  applicationArgs: z.array(z.string()).optional().describe('Base64 application-args, selector first'),
  applicationAccounts: z
    .array(z.string())
    .optional()
    .describe('Referenced (foreign) accounts of an app call — address searches match on these'),
  methodName: z.string().optional().describe('ABI method name, when a spec is known'),
  methodArgs: z
    .array(
      z.object({
        name: z.string().optional(),
        type: z.string(),
        value: z.unknown().optional(),
      }),
    )
    .optional(),
  methodReturn: z.unknown().optional(),
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
  freezeTarget: z
    .string()
    .optional()
    .describe('Afrz target: the account whose asset holding is frozen or thawed'),
  frozen: z.boolean().optional().describe('Afrz new freeze status of the target holding'),
  assetConfig: formattedAssetConfigSchema
    .optional()
    .describe('Acfg asset parameters; present on creates and reconfigures, absent on destroys'),
  createdAssetId: z
    .number()
    .optional()
    .describe('Asset ID assigned when this transaction created an asset'),
  createdApplicationId: z
    .number()
    .optional()
    .describe('Application ID assigned when this transaction created an application'),
  signer: z
    .string()
    .optional()
    .describe('Signing authority (auth-addr); present only when it differs from the sender'),
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
/** The filter a transaction search ran with, echoed so the card can show it. */
export const transactionQuerySchema = z.object({
  txType: z.string().optional(),
  assetId: z.number().optional(),
  applicationId: z.number().optional(),
  minRound: z.number().optional(),
  maxRound: z.number().optional(),
  notePrefix: z.string().optional(),
})
export type TransactionQuery = z.infer<typeof transactionQuerySchema>

export function transactionQueryOf(args: TransactionQuery): TransactionQuery | undefined {
  const query = Object.fromEntries(
    (['txType', 'assetId', 'applicationId', 'minRound', 'maxRound', 'notePrefix'] as const)
      .filter((key) => args[key] !== undefined)
      .map((key) => [key, args[key]]),
  ) as TransactionQuery
  return Object.keys(query).length > 0 ? query : undefined
}

export const transactionListSchema = z.object({
  transactions: z.array(formattedTransactionSchema),
  nextToken: z.string().optional(),
  query: transactionQuerySchema.optional(),
})
