import { z, type ZodSchema } from 'zod'
import type algosdk from 'algosdk'
import {
  getNetworkStatus,
  lookupAccount,
  searchAccountTransactions,
  searchAccounts,
  getAccountAssets,
  getAccountAppLocalStates,
  lookupTransaction,
  searchTransactions,
  lookupTransactionGroup,
  lookupAsset,
  searchAssetBalances,
  searchAssetTransactions,
  searchAssets,
  lookupBlock,
  searchBlockHeaders,
  lookupApplication,
  searchApplications,
  lookupApplicationLogs,
} from './handlers/index.js'

/** Framework-agnostic tool definition that both MCP server and AI SDK can consume. */
export interface IndexerToolDefinition {
  name: string
  description: string
  parameters: ZodSchema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (indexer: algosdk.Indexer, args: any) => Promise<unknown>
}

const txTypeEnum = z
  .enum(['pay', 'keyreg', 'acfg', 'axfer', 'afrz', 'appl', 'stpf'])
  .optional()
  .describe('Filter by transaction type')

export const indexerTools: IndexerToolDefinition[] = [
  // Status
  {
    name: 'get_network_status',
    description:
      'Get the current network status including the latest round number. Use this to find the most recent block.',
    parameters: z.object({}),
    handler: async (indexer) => getNetworkStatus(indexer),
  },

  // Accounts
  {
    name: 'lookup_account',
    description:
      'Get detailed information about an Algorand account by address, including balance, assets, and participation status',
    parameters: z.object({
      address: z.string().describe('The Algorand address to look up'),
    }),
    handler: async (indexer, args) => lookupAccount(indexer, args),
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
    handler: async (indexer, args) => searchAccountTransactions(indexer, args),
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
    handler: async (indexer, args) => searchAccounts(indexer, args),
  },
  {
    name: 'get_account_assets',
    description: 'Get all assets held by an account',
    parameters: z.object({
      address: z.string().describe('The Algorand address'),
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
    }),
    handler: async (indexer, args) => getAccountAssets(indexer, args),
  },
  {
    name: 'get_account_app_local_states',
    description: 'Get application local state for an account (the key-value data stored by apps the account has opted into)',
    parameters: z.object({
      address: z.string().describe('The Algorand address'),
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      applicationId: z.number().optional().describe('Filter by specific application ID'),
    }),
    handler: async (indexer, args) => getAccountAppLocalStates(indexer, args),
  },

  // Transactions
  {
    name: 'lookup_transaction',
    description: 'Look up a single transaction by its ID',
    parameters: z.object({
      txid: z.string().describe('The transaction ID to look up'),
    }),
    handler: async (indexer, args) => lookupTransaction(indexer, args),
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
    handler: async (indexer, args) => searchTransactions(indexer, args),
  },
  {
    name: 'lookup_transaction_group',
    description: 'Look up all transactions in an atomic transaction group by group ID',
    parameters: z.object({
      groupId: z.string().describe('The base64-encoded group ID'),
    }),
    handler: async (indexer, args) => lookupTransactionGroup(indexer, args),
  },

  // Assets
  {
    name: 'lookup_asset',
    description:
      'Look up an Algorand Standard Asset (ASA) by its ID. Common ASA IDs: USDC=31566704, USDT=312769, goETH=386192725, goBTC=386195940',
    parameters: z.object({
      assetId: z.number().describe('The asset ID to look up'),
    }),
    handler: async (indexer, args) => lookupAsset(indexer, args),
  },
  {
    name: 'search_asset_balances',
    description: 'Search for holders of a specific asset',
    parameters: z.object({
      assetId: z.number().describe('The asset ID'),
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      currencyGreaterThan: z.number().optional().describe('Min balance of the asset'),
      currencyLessThan: z.number().optional().describe('Max balance of the asset'),
    }),
    handler: async (indexer, args) => searchAssetBalances(indexer, args),
  },
  {
    name: 'search_asset_transactions',
    description: 'Search transactions for a specific asset',
    parameters: z.object({
      assetId: z.number().describe('The asset ID'),
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      beforeTime: z.string().optional().describe('Include results before this RFC 3339 time'),
      afterTime: z.string().optional().describe('Include results after this RFC 3339 time'),
    }),
    handler: async (indexer, args) => searchAssetTransactions(indexer, args),
  },
  {
    name: 'search_assets',
    description: 'Search for assets by name, unit name, or creator address',
    parameters: z.object({
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      name: z.string().optional().describe('Filter by asset name (exact match)'),
      unit: z.string().optional().describe('Filter by asset unit name (exact match)'),
      creator: z.string().optional().describe('Filter by creator address'),
    }),
    handler: async (indexer, args) => searchAssets(indexer, args),
  },

  // Blocks
  {
    name: 'lookup_block',
    description: 'Look up a block by its round number',
    parameters: z.object({
      round: z.number().describe('The round number of the block'),
    }),
    handler: async (indexer, args) => lookupBlock(indexer, args),
  },
  {
    name: 'search_block_headers',
    description:
      'Search blocks by time or round range. Useful for finding recent blocks or blocks in a time window.',
    parameters: z.object({
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      minRound: z.number().optional().describe('Include blocks at or after this round'),
      maxRound: z.number().optional().describe('Include blocks at or before this round'),
      beforeTime: z.string().optional().describe('Include blocks before this RFC 3339 time'),
      afterTime: z.string().optional().describe('Include blocks after this RFC 3339 time'),
    }),
    handler: async (indexer, args) => searchBlockHeaders(indexer, args),
  },

  // Applications
  {
    name: 'lookup_application',
    description: 'Look up a smart contract application by its ID',
    parameters: z.object({
      applicationId: z.number().describe('The application ID to look up'),
    }),
    handler: async (indexer, args) => lookupApplication(indexer, args),
  },
  {
    name: 'search_applications',
    description: 'Search for applications by creator address',
    parameters: z.object({
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      creator: z.string().optional().describe('Filter by creator address'),
    }),
    handler: async (indexer, args) => searchApplications(indexer, args),
  },
  {
    name: 'lookup_application_logs',
    description: 'Get log messages for a specific application',
    parameters: z.object({
      applicationId: z.number().describe('The application ID'),
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      txid: z.string().optional().describe('Filter by transaction ID'),
      minRound: z.number().optional().describe('Include logs at or after this round'),
      maxRound: z.number().optional().describe('Include logs at or before this round'),
    }),
    handler: async (indexer, args) => lookupApplicationLogs(indexer, args),
  },
]
