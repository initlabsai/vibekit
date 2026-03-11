import { z } from 'zod'
import type { ToolDefinition } from '@vibekit/core'
import { lookupAsset, searchAssetBalances, searchAssetTransactions, searchAssets } from './handlers/index'

export const assetTools: ToolDefinition[] = [
  {
    name: 'lookup_asset',
    description:
      'Look up an Algorand Standard Asset (ASA) by its ID. Common ASA IDs: USDC=31566704, USDT=312769, goETH=386192725, goBTC=386195940',
    parameters: z.object({
      assetId: z.number().describe('The asset ID to look up'),
    }),
    handler: async ({ algorand, args }) => lookupAsset(algorand, args),
  },
  {
    name: 'search_asset_balances',
    description:
      'Search for holders of a specific asset. IMPORTANT: Results are paginated by address, NOT sorted by balance. To find top/largest holders, you MUST set currencyGreaterThan to a high raw-unit value (e.g. for USDC with 6 decimals: 1000000000000 = $1M minimum). Without this filter, results will be arbitrary small holders.',
    parameters: z.object({
      assetId: z.number().describe('The asset ID'),
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      currencyGreaterThan: z.number().optional().describe('Min balance in raw base units (before decimal adjustment)'),
      currencyLessThan: z.number().optional().describe('Max balance in raw base units (before decimal adjustment)'),
    }),
    handler: async ({ algorand, args }) => searchAssetBalances(algorand, args),
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
    handler: async ({ algorand, args }) => searchAssetTransactions(algorand, args),
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
    handler: async ({ algorand, args }) => searchAssets(algorand, args),
  },
]
