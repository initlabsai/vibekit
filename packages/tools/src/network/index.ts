import { defineTool, type AnyTool } from '@initlabs/vibekit-core'
import { z } from 'zod'
import { searchBlockHeaders } from './handlers/block-headers.js'
import { lookupBlock } from './handlers/block.js'
import { getNetworkStatus } from './handlers/status.js'

export { lookupBlock, getNetworkStatus, searchBlockHeaders }

const blockSummary = z.object({
  round: z.number(),
  timestamp: z.number(),
  transactionCount: z.number(),
  proposer: z.string().optional(),
})

/** Wire shape of get_network ('network.status' view, deployment configuration). */
export const networkConfigSchema = z.object({
  network: z.string(),
  defaultNetwork: z.string(),
  servedNetworks: z.array(z.string()),
  algodUrl: z.string(),
  indexerUrl: z.string(),
  mode: z.enum(['execute', 'compose']),
})

/** Wire shape of get_network_status ('network.status' view, health metrics). */
export const networkStatusSchema = z.object({
  network: z.string(),
  latestRound: z.number(),
  timeSinceLastRound: z.number(),
  totalSupplyMicroAlgos: z
    .union([z.number(), z.string()])
    .describe(
      'Total supply in microALGOs (1 ALGO = 1,000,000 microALGOs); decimal string when above 2^53',
    ),
  onlineStakeMicroAlgos: z
    .union([z.number(), z.string()])
    .describe(
      'Online stake in microALGOs (1 ALGO = 1,000,000 microALGOs); decimal string when above 2^53',
    ),
  participation: z.number(),
  avgBlockTime: z.number(),
  avgTps: z.number(),
  peakTps: z.number(),
  avgTxnPerBlock: z.number(),
  totalTxns: z.number(),
  minBlockTime: z.number(),
  maxBlockTime: z.number(),
  consensusVersion: z.string(),
  catchupTime: z.number(),
  blockDetails: z.array(
    z.object({
      round: z.number(),
      txnCount: z.number(),
      blockTime: z.number(),
      tps: z.number(),
    }),
  ),
})

/** Wire shape of lookup_block ('block.detail' view). */
export const blockDetailSchema = blockSummary.extend({
  feesCollectedMicroAlgos: z
    .union([z.number(), z.string()])
    .optional()
    .describe(
      'Fees collected in microALGOs (1 ALGO = 1,000,000 microALGOs); decimal string when above 2^53',
    ),
  proposerPayoutMicroAlgos: z
    .union([z.number(), z.string()])
    .optional()
    .describe(
      'Proposer payout in microALGOs (1 ALGO = 1,000,000 microALGOs); decimal string when above 2^53',
    ),
  previousBlockHash: z.string().optional(),
  seed: z.string().optional(),
  transactionTypes: z.array(
    z.object({
      type: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
})

/** Wire shape of search_block_headers ('block.list' view). */
export const blockListSchema = z.object({
  blocks: z.array(blockSummary),
  nextToken: z.string().optional(),
})

export const networkTools: AnyTool[] = [
  defineTool({
    name: 'get_network',
    description:
      'Get this deployment\'s network configuration: which networks are served, the default network, endpoints, and signing mode. Use to orient before network-specific calls.',
    parameters: z.object({}),
    output: networkConfigSchema,
    view: 'table',
    handler: async (ctx) => ({
      network: ctx.network.id,
      defaultNetwork: ctx.defaultNetwork,
      servedNetworks: ctx.servedNetworks,
      algodUrl: ctx.network.algod.url,
      indexerUrl: ctx.network.indexer.url,
      mode: ctx.mode,
    }),
  }),
  defineTool({
    name: 'get_network_status',
    description:
      'Get network health dashboard: current round, TPS, block time, supply, participation. Use when users ask about network status, health, metrics, or stats.',
    parameters: z.object({}),
    output: networkStatusSchema,
    view: 'network.status',
    handler: async (ctx) => getNetworkStatus(ctx),
  }),
  defineTool({
    name: 'lookup_block',
    description:
      'Look up a block by its round number. Omit round for the latest. Returns header facts and type totals only — not the transactions. To list or filter that round, call search_transactions with minRound and maxRound set to the round; add txType (pay, axfer, appl) to filter.',
    parameters: z.object({
      round: z.number().optional().describe('The round number of the block (omit for latest)'),
    }),
    output: blockDetailSchema,
    view: 'block.detail',
    handler: async (ctx, args) => lookupBlock(ctx, args),
  }),
  defineTool({
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
    output: blockListSchema,
    view: 'block.list',
    handler: async (ctx, args) => searchBlockHeaders(ctx, args),
  }),
] as AnyTool[]
