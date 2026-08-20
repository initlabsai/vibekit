import { defineTool, type AnyTool } from '@initlabs/vibekit-core'
import { z } from 'zod'
import { transactionListSchema } from '../shared/format.js'
import { getAccountAppLocalStates, getAccountAssets } from './handlers/assets.js'
import { batchLookupAccounts, lookupAccount } from './handlers/lookup.js'
import { getAccountPortfolio } from './handlers/portfolio.js'
import { searchAccounts, searchAccountTransactions } from './handlers/search.js'

export {
  lookupAccount,
  batchLookupAccounts,
  searchAccounts,
  searchAccountTransactions,
  getAccountAssets,
  getAccountAppLocalStates,
  getAccountPortfolio,
}

/** Wire shape of lookup_account ('account.summary' view). */
export const formattedAccountSchema = z.object({
  address: z.string(),
  balanceAlgos: z.number(),
  totalAssetsOptedIn: z.number().optional(),
  totalAppsOptedIn: z.number().optional(),
  totalCreatedAssets: z.number().optional(),
  totalCreatedApps: z.number().optional(),
  status: z.string().optional(),
  minBalanceAlgos: z.number().optional(),
  rekeyedTo: z.string().optional(),
  rewardBase: z.union([z.number(), z.string()]).optional(),
  createdAtRound: z.number().optional(),
})

/** Wire shape of batch_lookup_accounts and search_accounts ('account.list' view). */
export const accountListSchema = z.object({
  accounts: z.array(formattedAccountSchema),
  // batch_lookup_accounts never paginates; the key is optional and absent there.
  nextToken: z.string().optional(),
})

const accountAsset = z.object({
  assetId: z.number(),
  amount: z.string(),
  isFrozen: z.boolean(),
  name: z.string().optional(),
  unitName: z.string().optional(),
})

const accountAppLocalState = z.object({
  applicationId: z.number(),
  schema: z.object({
    numByteSlice: z.number(),
    numUint: z.number(),
  }),
  keyValue: z.array(
    z.object({
      key: z.string(),
      value: z.object({
        type: z.number(),
        bytes: z.string().optional(),
        uint: z
          .union([z.number(), z.string()])
          .optional()
          .describe('uint64 app state; decimal string when above 2^53'),
      }),
    }),
  ),
})

/** Wire shape of get_account_assets ('asset.list' view, holdings rows). */
export const accountAssetListSchema = z.object({
  assets: z.array(accountAsset),
  nextToken: z.string().optional(),
})

/** Wire shape of get_account_app_local_states ('application.state' view). */
export const appLocalStatesSchema = z.object({
  appLocalStates: z.array(accountAppLocalState),
  nextToken: z.string().optional(),
})

/** Wire shape of get_account_portfolio ('account.portfolio' view). */
export const accountPortfolioSchema = z.object({
  address: z.string(),
  algoBalance: z.number(),
  assets: z.array(accountAsset),
  totalAssets: z.number(),
})

const txTypeEnum = z
  .enum(['pay', 'keyreg', 'acfg', 'axfer', 'afrz', 'appl', 'stpf', 'hb'])
  .optional()
  .describe('Filter by transaction type')

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
    view: 'asset.list',
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
    view: 'application.state',
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
] as AnyTool[]
