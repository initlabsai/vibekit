import { defineTool, type AnyTool } from '@initlabs/core'
import { z } from 'zod'
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

const formattedAccount = z.object({
  address: z.string(),
  balanceAlgos: z.number(),
  totalAssetsOptedIn: z.number().optional(),
  totalAppsOptedIn: z.number().optional(),
  totalCreatedAssets: z.number().optional(),
  totalCreatedApps: z.number().optional(),
  status: z.string().optional(),
  rewardBase: z.number().optional(),
  createdAtRound: z.number().optional(),
})

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
        uint: z.number().optional(),
      }),
    }),
  ),
})

const txTypeEnum = z
  .enum(['pay', 'keyreg', 'acfg', 'axfer', 'afrz', 'appl', 'stpf'])
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
    output: formattedAccount,
    display: 'account',
    handler: async (ctx, args) => lookupAccount(ctx, args),
  }),
  defineTool({
    name: 'batch_lookup_accounts',
    description:
      'Look up multiple Algorand accounts at once. Prefer this over repeated single lookup_account calls when looking up 2 or more addresses.',
    parameters: z.object({
      addresses: z.array(z.string()).describe('The Algorand addresses to look up'),
    }),
    output: z.object({
      accounts: z.array(formattedAccount),
    }),
    display: 'table',
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
    output: z.object({
      accounts: z.array(formattedAccount),
      nextToken: z.string().optional(),
    }),
    display: 'table',
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
    output: z.object({
      transactions: z.array(formattedTransaction),
      nextToken: z.string().optional(),
    }),
    display: 'table',
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
    output: z.object({
      assets: z.array(accountAsset),
      nextToken: z.string().optional(),
    }),
    display: 'table',
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
    output: z.object({
      appLocalStates: z.array(accountAppLocalState),
      nextToken: z.string().optional(),
    }),
    display: 'table',
    handler: async (ctx, args) => getAccountAppLocalStates(ctx, args),
  }),
  defineTool({
    name: 'get_account_portfolio',
    description: 'Get an account portfolio with all asset holdings and ALGO balance.',
    parameters: z.object({
      address: z.string().describe('Algorand address'),
    }),
    output: z.object({
      address: z.string(),
      algoBalance: z.number(),
      assets: z.array(accountAsset),
      totalAssets: z.number(),
    }),
    display: 'account',
    handler: async (ctx, args) => getAccountPortfolio(ctx, args),
  }),
] as AnyTool[]
