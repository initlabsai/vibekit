import { defineTool, type AnyTool } from '../../core/index.js'
import { z } from 'zod'
import { formattedTransactionSchema, transactionListSchema, txTypeEnum } from '../shared/schemas.js'
import { lookupTransaction, lookupTransactionGroup } from './lookup.js'
import { searchTransactions } from './search.js'
import { transactionGroupSchema } from './schemas.js'

export * from './schemas.js'
export { lookupTransaction, lookupTransactionGroup, searchTransactions }
export type { SearchTransactionsArgs } from './search.js'
export type { FormattedTransaction } from '../shared/schemas.js'
export { formattedTransactionSchema, transactionListSchema } from '../shared/schemas.js'

export { transactionActions, txnSpecSchema } from './actions.js'

export const transactionQueries: AnyTool[] = [
  defineTool({
    name: 'lookup_transaction',
    description: 'Look up a single transaction by its ID',
    parameters: z.object({
      txid: z.string().describe('The transaction ID to look up'),
    }),
    output: formattedTransactionSchema,
    view: 'transaction.detail',
    handler: async (ctx, args) => lookupTransaction(ctx, args),
  }),
  defineTool({
    name: 'search_transactions',
    description:
      'Search transactions and render a transaction list card. Results come OLDEST first within the bounds you set, and nextToken walks forward. Always bound a search: set minRound or a round/time window — an unbounded txType-only search times out at the indexer. For the LATEST activity, keep the window tiny: minRound = the current round from get_network_status minus 30, read the last row, and only widen (×4) if the page came back empty — a wide window fills pages with old rows before it reaches the tip. To list a block, set minRound and maxRound to that round. To filter by kind, set txType (pay, axfer, appl, …). For one account use search_account_transactions. Do not recap results as markdown — the list card is the answer.',
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
      maxAmount: z.number().optional().describe('Filter by maximum amount (microAlgos, inclusive)'),
      applicationId: z.number().optional().describe('Filter by application ID'),
      notePrefix: z
        .string()
        .optional()
        .describe('Only transactions whose note starts with this UTF-8 text (e.g. a protocol tag)'),
    }),
    output: transactionListSchema,
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
    output: transactionGroupSchema,
    view: 'transaction.group',
    handler: async (ctx, args) => lookupTransactionGroup(ctx, args),
  }),
]
