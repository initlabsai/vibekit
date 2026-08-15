import { defineTool, type AnyTool } from '@initlabs/vibekit-core'
import { z } from 'zod'
import { lookupAsset } from './handlers/lookup.js'
import { searchAssetBalances, searchAssetTransactions, searchAssets } from './handlers/search.js'

export { lookupAsset, searchAssetBalances, searchAssetTransactions, searchAssets }
export type { FormattedAsset, FormattedTransaction, AssetBalance } from './handlers/format.js'

const assetSummary = z.object({
  assetId: z.number(),
  name: z.string().optional(),
  unitName: z.string().optional(),
  totalSupply: z.string(),
  decimals: z.number(),
  creator: z.string().optional(),
  manager: z.string().optional(),
  reserve: z.string().optional(),
  freeze: z.string().optional(),
  clawback: z.string().optional(),
  defaultFrozen: z.boolean().optional(),
  url: z.string().optional(),
})

const transactionSummary: z.ZodType = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.string(),
    sender: z.string(),
    fee: z.number(),
    confirmedRound: z.number().optional(),
    roundTime: z.number().optional(),
    paymentAmount: z.number().optional(),
    receiver: z.string().optional(),
    assetId: z.number().optional(),
    assetAmount: z.union([z.number(), z.string()]).optional(),
    applicationId: z.number().optional(),
    note: z.string().optional(),
    group: z.string().optional(),
    innerTxns: z.array(transactionSummary).optional(),
    globalStateDelta: z.unknown().optional(),
    localStateDelta: z.unknown().optional(),
    logs: z.array(z.string()).optional(),
  }),
)

export { assetWriteTools } from './tools-write.js'

export const assetTools: AnyTool[] = [
  defineTool({
    name: 'lookup_asset',
    description:
      'Look up an Algorand Standard Asset (ASA) by its ID. Common ASA IDs: USDC=31566704, USDT=312769, goETH=386192725, goBTC=386195940',
    parameters: z.object({
      assetId: z.number().describe('The asset ID to look up'),
    }),
    output: assetSummary,
    display: 'asset',
    handler: async (ctx, args) => lookupAsset(ctx, args),
  }),
  defineTool({
    name: 'search_asset_balances',
    description:
      'Search for holders of a specific asset. IMPORTANT: Results are paginated by address, NOT sorted by balance. To find top/largest holders, you MUST set currencyGreaterThan to a high raw-unit value (e.g. for USDC with 6 decimals: 1000000000000 = $1M minimum). Without this filter, results will be arbitrary small holders.',
    parameters: z.object({
      assetId: z.number().describe('The asset ID'),
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      currencyGreaterThan: z
        .number()
        .optional()
        .describe('Min balance in raw base units (before decimal adjustment)'),
      currencyLessThan: z
        .number()
        .optional()
        .describe('Max balance in raw base units (before decimal adjustment)'),
    }),
    output: z.object({
      balances: z.array(
        z.object({
          address: z.string(),
          amount: z.string(),
          isFrozen: z.boolean(),
        }),
      ),
      nextToken: z.string().optional(),
    }),
    display: 'table',
    handler: async (ctx, args) => searchAssetBalances(ctx, args),
  }),
  defineTool({
    name: 'search_asset_transactions',
    description: 'Search transactions for a specific asset',
    parameters: z.object({
      assetId: z.number().describe('The asset ID'),
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      beforeTime: z.string().optional().describe('Include results before this RFC 3339 time'),
      afterTime: z.string().optional().describe('Include results after this RFC 3339 time'),
    }),
    output: z.object({
      transactions: z.array(transactionSummary),
      nextToken: z.string().optional(),
    }),
    display: 'table',
    handler: async (ctx, args) => searchAssetTransactions(ctx, args),
  }),
  defineTool({
    name: 'search_assets',
    description: 'Search for assets by name, unit name, or creator address',
    parameters: z.object({
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      name: z.string().optional().describe('Filter by asset name (exact match)'),
      unit: z.string().optional().describe('Filter by asset unit name (exact match)'),
      creator: z.string().optional().describe('Filter by creator address'),
    }),
    output: z.object({
      assets: z.array(assetSummary),
      nextToken: z.string().optional(),
    }),
    display: 'table',
    handler: async (ctx, args) => searchAssets(ctx, args),
  }),
] as AnyTool[]
