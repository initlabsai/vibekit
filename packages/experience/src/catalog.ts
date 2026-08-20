import { z } from 'zod'

import { uint64JsonSchema } from './algo.js'
import { algorandAddressCandidateSchema } from './classifier.js'

const optionalAddress = z.string().min(1).optional()

/** One transaction row in a list or group. Inner transactions are counted, not nested. */
export const transactionRowSchema = z
  .object({
    id: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
    sender: z.string().min(1),
    receiver: optionalAddress,
    paymentAmountMicroAlgos: uint64JsonSchema.optional(),
    feeMicroAlgos: uint64JsonSchema.optional(),
    assetId: uint64JsonSchema.optional(),
    assetAmount: uint64JsonSchema.optional(),
    applicationId: uint64JsonSchema.optional(),
    confirmedRound: z.number().int().nonnegative().optional(),
    roundTime: z.number().int().nonnegative().optional(),
    innerCount: z.number().int().nonnegative().optional(),
  })
  .strict()

/** A page of transactions, optionally scoped to a group id or account. */
export const transactionCollectionDataSchema = z
  .object({
    groupId: z.string().min(1).optional(),
    address: optionalAddress,
    transactions: z.array(transactionRowSchema),
    nextToken: z.string().min(1).optional(),
  })
  .strict()

/** Compact account facts for summary and list cards. */
export const accountSummaryDataSchema = z
  .object({
    address: algorandAddressCandidateSchema,
    balanceMicroAlgos: uint64JsonSchema,
    status: z.string().min(1).optional(),
    minBalanceMicroAlgos: uint64JsonSchema.optional(),
    rekeyedTo: algorandAddressCandidateSchema.optional(),
    totalAssetsOptedIn: z.number().int().nonnegative().optional(),
    totalAppsOptedIn: z.number().int().nonnegative().optional(),
    totalCreatedAssets: z.number().int().nonnegative().optional(),
    totalCreatedApps: z.number().int().nonnegative().optional(),
    createdAtRound: z.number().int().nonnegative().optional(),
  })
  .strict()

/** A page of account summaries. */
export const accountListDataSchema = z
  .object({
    accounts: z.array(accountSummaryDataSchema),
    nextToken: z.string().min(1).optional(),
  })
  .strict()

/** One asset row in a catalog or holdings list. */
export const assetRowSchema = z
  .object({
    assetId: uint64JsonSchema,
    name: z.string().min(1).optional(),
    unitName: z.string().min(1).optional(),
    amount: z.string().min(1).optional(),
    isFrozen: z.boolean().optional(),
    totalSupply: z.string().regex(/^\d+$/).optional(),
    decimals: z.number().int().nonnegative().optional(),
    creator: optionalAddress,
  })
  .strict()

/** A page of assets (search or account holdings). */
export const assetListDataSchema = z
  .object({
    assets: z.array(assetRowSchema),
    nextToken: z.string().min(1).optional(),
  })
  .strict()

/** One holder of an asset. */
export const assetHolderRowSchema = z
  .object({
    address: z.string().min(1),
    amount: z.string().min(1),
    isFrozen: z.boolean(),
  })
  .strict()

/** A page of asset holders. */
export const assetHoldersDataSchema = z
  .object({
    balances: z.array(assetHolderRowSchema),
    nextToken: z.string().min(1).optional(),
  })
  .strict()

/** One application row in a list. */
export const applicationRowSchema = z
  .object({
    applicationId: uint64JsonSchema,
    creator: optionalAddress,
    globalStateCount: z.number().int().nonnegative().optional(),
  })
  .strict()

/** A page of applications. */
export const applicationListDataSchema = z
  .object({
    applications: z.array(applicationRowSchema),
    nextToken: z.string().min(1).optional(),
  })
  .strict()

/** One decoded application state entry. */
export const applicationStateEntrySchema = z
  .object({
    key: z.string().min(1),
    value: z.string(),
    type: z.enum(['uint', 'bytes']),
  })
  .strict()

/** One application's local or global state. */
export const applicationStateAppSchema = z
  .object({
    applicationId: uint64JsonSchema,
    optedIn: z.boolean().optional(),
    schema: z
      .object({
        numByteSlice: z.number().int().nonnegative(),
        numUint: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
    entries: z.array(applicationStateEntrySchema),
  })
  .strict()

/** Local or global application state for one or more apps. */
export const applicationStateDataSchema = z
  .object({
    scope: z.enum(['local', 'global']),
    address: optionalAddress,
    apps: z.array(applicationStateAppSchema),
    nextToken: z.string().min(1).optional(),
  })
  .strict()

/** Application log lines grouped by transaction. */
export const applicationLogsDataSchema = z
  .object({
    applicationId: uint64JsonSchema,
    logData: z.array(
      z
        .object({
          txid: z.string().min(1),
          logs: z.array(z.string()),
        })
        .strict(),
    ),
    nextToken: z.string().min(1).optional(),
  })
  .strict()

/** One application box value. */
export const applicationBoxDataSchema = z
  .object({
    applicationId: uint64JsonSchema,
    boxName: z.string().min(1),
    exists: z.boolean(),
    value: z.string().optional(),
    size: z.number().int().nonnegative().optional(),
  })
  .strict()

/** One block header row. */
export const blockRowSchema = z
  .object({
    round: z.number().int().nonnegative(),
    timestamp: z.number().int().nonnegative(),
    transactionCount: z.number().int().nonnegative(),
    proposer: optionalAddress,
  })
  .strict()

/** A page of block headers. */
export const blockListDataSchema = z
  .object({
    blocks: z.array(blockRowSchema),
    nextToken: z.string().min(1).optional(),
  })
  .strict()

export type TransactionCollectionData = z.infer<typeof transactionCollectionDataSchema>
export type AccountSummaryData = z.infer<typeof accountSummaryDataSchema>
export type AccountListData = z.infer<typeof accountListDataSchema>
export type AssetListData = z.infer<typeof assetListDataSchema>
export type AssetHoldersData = z.infer<typeof assetHoldersDataSchema>
export type ApplicationListData = z.infer<typeof applicationListDataSchema>
export type ApplicationStateData = z.infer<typeof applicationStateDataSchema>
export type ApplicationLogsData = z.infer<typeof applicationLogsDataSchema>
export type ApplicationBoxData = z.infer<typeof applicationBoxDataSchema>
export type BlockListData = z.infer<typeof blockListDataSchema>
