import { z } from 'zod'
import type { ToolDefinition } from '@vibekit/core'
import { lookupTransaction, lookupTransactionGroup, searchTransactions } from './handlers/index'

const txTypeEnum = z
  .enum(['pay', 'keyreg', 'acfg', 'axfer', 'afrz', 'appl', 'stpf'])
  .optional()
  .describe('Filter by transaction type')

export const transactionTools: ToolDefinition[] = [
  {
    name: 'lookup_transaction',
    description: 'Look up a single transaction by its ID',
    parameters: z.object({
      txid: z.string().describe('The transaction ID to look up'),
    }),
    handler: async (algorand, args) => lookupTransaction(algorand, args),
  },
  {
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
    handler: async (algorand, args) => searchTransactions(algorand, args),
  },
  {
    name: 'lookup_transaction_group',
    description: 'Look up all transactions in an atomic transaction group by group ID',
    parameters: z.object({
      groupId: z.string().describe('The base64-encoded group ID'),
    }),
    handler: async (algorand, args) => lookupTransactionGroup(algorand, args),
  },
]
