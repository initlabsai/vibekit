import { defineTool, type AnyTool } from '@initlabs/vibekit-core'
import { z } from 'zod'
import { lookupTransaction, lookupTransactionGroup } from './handlers/lookup.js'
import { searchTransactions } from './handlers/search.js'

export { lookupTransaction, lookupTransactionGroup, searchTransactions }
export type { SearchTransactionsArgs } from './handlers/search.js'
export type { FormattedTransaction } from './handlers/format.js'

const formattedTransaction = z.object({
  // The indexer assigns no id to inner transactions, and txType is optional
  // in the indexer model — both keys are absent when unset (jsonSafe drops
  // undefined entries).
  id: z.string().optional(),
  type: z.string().optional(),
  sender: z.string(),
  fee: z.number().describe('Fee in ALGO (not microALGO)'),
  confirmedRound: z.number().optional(),
  roundTime: z.number().optional(),
  paymentAmount: z.number().optional().describe('Payment amount in ALGO (not microALGO)'),
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
  closeAmount: z.union([z.number(), z.string()]).optional(),
  clawbackFrom: z.string().optional(),
  note: z.string().optional(),
  group: z.string().optional(),
  get innerTxns() {
    return z.array(formattedTransaction).optional()
  },
  globalStateDelta: z.unknown().optional(),
  localStateDelta: z.unknown().optional(),
  logs: z.array(z.string()).optional(),
})

const txTypeEnum = z
  .enum(['pay', 'keyreg', 'acfg', 'axfer', 'afrz', 'appl', 'stpf', 'hb'])
  .optional()
  .describe('Filter by transaction type')

export { transactionWriteTools, txnSpecSchema } from './tools-write.js'

export const transactionTools: AnyTool[] = [
  defineTool({
    name: 'lookup_transaction',
    description: 'Look up a single transaction by its ID',
    parameters: z.object({
      txid: z.string().describe('The transaction ID to look up'),
    }),
    output: formattedTransaction,
    view: 'transaction.detail',
    handler: async (ctx, args) => lookupTransaction(ctx, args),
  }),
  defineTool({
    name: 'search_transactions',
    description:
      'Search transactions and render a transaction list card. To list a block, set minRound and maxRound to that round. To filter by kind, set txType (pay, axfer, appl, …). Do not recap results as markdown — the list card is the answer.',
    parameters: z.object({
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      txType: txTypeEnum,
      assetId: z.number().optional().describe('Filter by asset ID'),
      minRound: z.number().optional().describe('Include results at or after this round'),
      maxRound: z.number().optional().describe('Include results at or before this round'),
      beforeTime: z.string().optional().describe('Include results before this RFC 3339 time'),
      afterTime: z.string().optional().describe('Include results after this RFC 3339 time'),
      minAmount: z.number().optional().describe('Filter by minimum amount (microAlgos)'),
      applicationId: z.number().optional().describe('Filter by application ID'),
    }),
    output: z.object({
      transactions: z.array(formattedTransaction),
      nextToken: z.string().optional(),
    }),
    view: 'transaction.list',
    handler: async (ctx, args) => searchTransactions(ctx, args),
  }),
  defineTool({
    name: 'lookup_transaction_group',
    description:
      'Look up all transactions in an atomic transaction group by group ID. The group ID is the base64 of the 32-byte group hash (44 characters, trailing =), as shown on a transaction card.',
    parameters: z.object({
      groupId: z.string().describe('The base64-encoded 32-byte group ID'),
    }),
    output: z.object({
      groupId: z.string(),
      transactions: z.array(formattedTransaction),
      nextToken: z.string().optional(),
    }),
    view: 'transaction.group',
    handler: async (ctx, args) => lookupTransactionGroup(ctx, args),
  }),
] as AnyTool[]
