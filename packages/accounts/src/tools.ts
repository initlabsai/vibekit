import { z } from 'zod'
import type { ToolDefinition } from '@vibekit/core'
import {
  lookupAccount,
  batchLookupAccounts,
  searchAccounts,
  searchAccountTransactions,
  getAccountAssets,
  getAccountAppLocalStates,
  getAccountPortfolio,
} from './handlers/index'

const txTypeEnum = z
  .enum(['pay', 'keyreg', 'acfg', 'axfer', 'afrz', 'appl', 'stpf'])
  .optional()
  .describe('Filter by transaction type')

export const accountTools: ToolDefinition[] = [
  {
    name: 'lookup_account',
    description:
      'Get detailed information about an Algorand account by address, including balance, assets, and participation status',
    parameters: z.object({
      address: z.string().describe('The Algorand address to look up'),
    }),
    handler: async ({ algorand, args }) => lookupAccount(algorand, args),
  },
  {
    name: 'batch_lookup_accounts',
    description:
      'Look up multiple Algorand accounts at once. Prefer this over repeated single lookup_account calls when looking up 2 or more addresses.',
    parameters: z.object({
      addresses: z.array(z.string()).describe('The Algorand addresses to look up'),
    }),
    handler: async ({ algorand, args }) => batchLookupAccounts(algorand, args),
  },
  {
    name: 'search_accounts',
    description:
      'Search for accounts by criteria like asset held, minimum balance, or application opted in',
    parameters: z.object({
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      assetId: z.number().optional().describe('Filter by accounts holding this asset'),
      applicationId: z.number().optional().describe('Filter by accounts opted into this app'),
      currencyGreaterThan: z.number().optional().describe('Min balance in microAlgos'),
      currencyLessThan: z.number().optional().describe('Max balance in microAlgos'),
    }),
    handler: async ({ algorand, args }) => searchAccounts(algorand, args),
  },
  {
    name: 'search_account_transactions',
    description: 'Search transactions for a specific account with optional filters',
    parameters: z.object({
      address: z.string().describe('The Algorand address'),
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token from a previous response'),
      assetId: z.number().optional().describe('Filter by asset ID'),
      txType: txTypeEnum,
      minRound: z.number().optional().describe('Include results at or after this round'),
      maxRound: z.number().optional().describe('Include results at or before this round'),
      beforeTime: z.string().optional().describe('Include results before this RFC 3339 time'),
      afterTime: z.string().optional().describe('Include results after this RFC 3339 time'),
      minAmount: z.number().optional().describe('Filter by minimum amount (microAlgos)'),
    }),
    handler: async ({ algorand, args }) => searchAccountTransactions(algorand, args),
  },
  {
    name: 'get_account_assets',
    description: 'Get all assets held by an account',
    parameters: z.object({
      address: z.string().describe('The Algorand address'),
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
    }),
    handler: async ({ algorand, args }) => getAccountAssets(algorand, args),
  },
  {
    name: 'get_account_app_local_states',
    description:
      'Get application local state for an account (the key-value data stored by apps the account has opted into)',
    parameters: z.object({
      address: z.string().describe('The Algorand address'),
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      applicationId: z.number().optional().describe('Filter by specific application ID'),
    }),
    handler: async ({ algorand, args }) => getAccountAppLocalStates(algorand, args),
  },
  {
    name: 'get_account_portfolio',
    description: 'Get an account portfolio with all asset holdings and ALGO balance.',
    parameters: z.object({
      address: z.string().describe('Algorand address'),
    }),
    handler: async ({ algorand, args }) => getAccountPortfolio(algorand, args),
  },
]
