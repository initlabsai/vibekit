import { defineTool, ToolError, type AnyTool } from '../../core/index.js'
import { z } from 'zod'
import { transactionListSchema } from '../shared/schemas.js'
import { lookupAsset } from './lookup.js'
import { topAssetHolders } from './holders.js'
import { approxWords, scaleBaseUnits } from './format.js'
import { searchAssetTransactions, searchAssets } from './search.js'
import { assetDetailSchema, assetHoldersSchema, assetListSchema } from './schemas.js'

export * from './schemas.js'
export { lookupAsset, searchAssetTransactions, searchAssets }
export type { FormattedAsset, AssetBalance } from './format.js'
export type { FormattedTransaction } from '../shared/schemas.js'

export { assetActions } from './actions.js'

export const assetQueries: AnyTool[] = [
  defineTool({
    name: 'lookup_asset',
    description:
      'Look up an Algorand Standard Asset (ASA) by its ID via the indexer: params plus creation round; a destroyed asset still resolves. Common ASA IDs: USDC=31566704, USDT=312769, goETH=386192725, goBTC=386195940. get_asset_info is the algod view of the same asset.',
    parameters: z.object({
      assetId: z.number().describe('The asset ID to look up'),
    }),
    output: assetDetailSchema,
    view: 'asset.detail',
    handler: async (ctx, args) => lookupAsset(ctx, args),
  }),
  defineTool({
    name: 'top_asset_holders',
    description:
      'The largest holders of an asset, sorted by balance — scans every holder via the indexer, so it is authoritative. Use for "top holders", "biggest bags", "whale watch", or concentration questions. Not paginated; ask for a bigger limit instead. minBalance/maxBalance (raw base units) narrow the set — "who holds more than N".',
    parameters: z.object({
      assetId: z.number().describe('The asset ID'),
      limit: z.number().optional().describe('How many top holders to return (default 10, max 100)'),
      minBalance: z
        .number()
        .optional()
        .describe('Only holders with more than this (raw base units)'),
      maxBalance: z
        .number()
        .optional()
        .describe('Only holders with less than this (raw base units)'),
    }),
    // Superset of the shared 'asset.holders' shape; extra per-row fields
    // (amountScaled, percentOfSupply) ride through validation to the agent.
    output: assetHoldersSchema,
    view: 'asset.holders',
    handler: async (ctx, args) => topAssetHolders(ctx, args),
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
      minAmount: z.number().optional().describe('Filter by minimum amount (microAlgos)'),
      maxAmount: z.number().optional().describe('Filter by maximum amount (microAlgos, inclusive)'),
      notePrefix: z
        .string()
        .optional()
        .describe('Only transactions whose note starts with this UTF-8 text (e.g. a protocol tag)'),
    }),
    output: transactionListSchema,
    view: 'transaction.list',
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
    output: assetListSchema,
    view: 'asset.list',
    handler: async (ctx, args) => searchAssets(ctx, args),
  }),
  defineTool({
    name: 'get_asset_info',
    description:
      "An asset's current parameters straight from algod (name, supply, roles, frozen state); fails once the asset is destroyed. Same shape as lookup_asset, which is the indexer view.",
    parameters: z.object({ assetId: z.number().describe('The asset ID') }),
    output: assetDetailSchema,
    view: 'asset.detail',
    handler: async (ctx, args) => {
      const asset = await ctx.algod.getAssetByID(BigInt(args.assetId)).do()
      const params = asset.params
      if (!params) {
        throw new ToolError('ASSET_NOT_FOUND', `Asset ${args.assetId} has no parameters`)
      }
      return {
        assetId: Number(asset.index),
        name: params.name,
        unitName: params.unitName,
        totalSupply: String(params.total),
        totalSupplyScaled: scaleBaseUnits(params.total, Number(params.decimals)),
        totalSupplyApprox: approxWords(scaleBaseUnits(params.total, Number(params.decimals))),
        decimals: Number(params.decimals),
        defaultFrozen: params.defaultFrozen,
        url: params.url,
        creator: String(params.creator),
        manager: params.manager ? String(params.manager) : undefined,
        reserve: params.reserve ? String(params.reserve) : undefined,
        freeze: params.freeze ? String(params.freeze) : undefined,
        clawback: params.clawback ? String(params.clawback) : undefined,
      }
    },
  }),
]
