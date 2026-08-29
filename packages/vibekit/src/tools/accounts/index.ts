import { defineTool, type AnyTool } from '../../core/index.js'
import { z } from 'zod'
import { transactionListSchema, txTypeEnum } from '../shared/schemas.js'
import { getAccountAppLocalStates, getAccountAssets } from './assets.js'
import { batchLookupAccounts, lookupAccount } from './lookup.js'
import { getAccountPortfolio } from './portfolio.js'
import { searchAccounts, searchAccountTransactions } from './search.js'
import {
  accountAssetListSchema,
  accountListSchema,
  accountPortfolioSchema,
  appLocalStatesSchema,
  formattedAccountSchema,
} from './schemas.js'

export * from './schemas.js'
export {
  lookupAccount,
  batchLookupAccounts,
  searchAccounts,
  searchAccountTransactions,
  getAccountAssets,
  getAccountAppLocalStates,
  getAccountPortfolio,
}

export const accountTools: AnyTool[] = [
  defineTool({
    name: 'lookup_account',
    description:
      'Get detailed information about an Algorand account by address, including balance, assets, and participation status',
    parameters: z.object({
      address: z.string().describe('The Algorand address to look up'),
    }),
    output: formattedAccountSchema,
    view: 'account.summary',
    handler: async (ctx, args) => lookupAccount(ctx, args),
  }),
  defineTool({
    name: 'batch_lookup_accounts',
    description:
      'Look up multiple Algorand accounts at once. Prefer this over repeated single lookup_account calls when looking up 2 or more addresses.',
    parameters: z.object({
      addresses: z.array(z.string()).describe('The Algorand addresses to look up'),
    }),
    output: accountListSchema,
    view: 'account.list',
    handler: async (ctx, args) => batchLookupAccounts(ctx, args),
  }),
  defineTool({
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
    output: accountListSchema,
    view: 'account.list',
    handler: async (ctx, args) => searchAccounts(ctx, args),
  }),
  defineTool({
    name: 'search_account_transactions',
    description:
      "Search one account's transactions, NEWEST first (the opposite of search_transactions); nextToken walks back in time. Narrow with txType, assetId, addressRole (sender or receiver), rounds, or times before paging. For the account's EARLIEST activity do not page from the top: take createdAtRound from lookup_account and search with minRound=createdAtRound and maxRound=createdAtRound+100000 — the last rows of that window are its first transactions.",
    parameters: z.object({
      address: z.string().describe('The Algorand address'),
      addressRole: z.enum(['sender', 'receiver']).optional().describe("Only transactions where the address was the sender or the receiver; unset means either. 'receiver' finds what an account was given."),
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token from a previous response'),
      assetId: z.number().optional().describe('Filter by asset ID'),
      txType: txTypeEnum,
      minRound: z.number().optional().describe('Include results at or after this round'),
      maxRound: z.number().optional().describe('Include results at or before this round'),
      beforeTime: z.string().optional().describe('Include results before this RFC 3339 time'),
      afterTime: z.string().optional().describe('Include results after this RFC 3339 time'),
      minAmount: z.number().optional().describe('Filter by minimum amount (microAlgos)'),
      maxAmount: z.number().optional().describe('Filter by maximum amount (microAlgos, inclusive)'),
      notePrefix: z
        .string()
        .optional()
        .describe('Only transactions whose note starts with this UTF-8 text (e.g. a protocol tag)'),
    }),
    output: transactionListSchema,
    view: 'transaction.list',
    handler: async (ctx, args) => searchAccountTransactions(ctx, args),
  }),
  defineTool({
    name: 'get_account_assets',
    description: 'Get all assets held by an account',
    parameters: z.object({
      address: z.string().describe('The Algorand address'),
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
    }),
    output: accountAssetListSchema,
    view: 'asset.holdings',
    handler: async (ctx, args) => getAccountAssets(ctx, args),
  }),
  defineTool({
    name: 'get_account_app_local_states',
    description:
      'Get application local state for an account (the key-value data stored by apps the account has opted into)',
    parameters: z.object({
      address: z.string().describe('The Algorand address'),
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      applicationId: z.number().optional().describe('Filter by specific application ID'),
    }),
    output: appLocalStatesSchema,
    view: 'application.locals',
    handler: async (ctx, args) => getAccountAppLocalStates(ctx, args),
  }),
  defineTool({
    name: 'get_account_portfolio',
    description: 'Get an account portfolio with all asset holdings and ALGO balance.',
    parameters: z.object({
      address: z.string().describe('Algorand address'),
    }),
    output: accountPortfolioSchema,
    view: 'account.portfolio',
    handler: async (ctx, args) => getAccountPortfolio(ctx, args),
  }),
]
