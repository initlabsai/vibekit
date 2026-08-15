import { defineTool, type AnyTool } from '@initlabs/core'
import { z } from 'zod'
import { lookupTransaction, lookupTransactionGroup } from './handlers/lookup.js'
import { searchTransactions } from './handlers/search.js'

export { lookupTransaction, lookupTransactionGroup, searchTransactions }
export type { SearchTransactionsArgs } from './handlers/search.js'
export type { FormattedTransaction } from './handlers/format.js'

const formattedTransaction = z.object({
  id: z.string(),
  type: z.string(),
  sender: z.string(),
  fee: z.number(),
  confirmedRound: z.number().optional(),
  roundTime: z.number().optional(),
  paymentAmount: z.number().optional(),
  receiver: z.string().optional(),
  assetId: z.number().optional(),
  assetName: z.string().optional(),
  assetUnitName: z.string().optional(),
  assetDecimals: z.number().optional(),
  assetAmount: z.union([z.number(), z.string()]).optional(),
  applicationId: z.number().optional(),
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
  .enum(['pay', 'keyreg', 'acfg', 'axfer', 'afrz', 'appl', 'stpf'])
  .optional()
  .describe('Filter by transaction type')

export const transactionTools: AnyTool[] = [
  defineTool({
    name: 'lookup_transaction',
    description: 'Look up a single transaction by its ID',
    parameters: z.object({
      txid: z.string().describe('The transaction ID to look up'),
    }),
    output: formattedTransaction,
    display: 'txn',
    handler: async (ctx, args) => lookupTransaction(ctx, args),
  }),
  defineTool({
    name: 'search_transactions',
    description:
      'Search transactions globally with filters like type, amount, date range, and round range',
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
    display: 'table',
    handler: async (ctx, args) => searchTransactions(ctx, args),
  }),
  defineTool({
    name: 'lookup_transaction_group',
    description: 'Look up all transactions in an atomic transaction group by group ID',
    parameters: z.object({
      groupId: z.string().describe('The base64-encoded group ID'),
    }),
    output: z.object({
      transactions: z.array(formattedTransaction),
      nextToken: z.string().optional(),
    }),
    display: 'table',
    handler: async (ctx, args) => lookupTransactionGroup(ctx, args),
  }),
] as AnyTool[]
