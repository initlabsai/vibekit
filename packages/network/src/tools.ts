import { z } from 'zod'
import type { ToolDefinition } from '@vibekit/core'
import { getNetworkStatus, lookupBlock, searchBlockHeaders } from './handlers/index'

export const networkTools: ToolDefinition[] = [
  {
    name: 'get_network_status',
    description:
      'Get network health dashboard: current round, TPS, block time, supply, participation. Use when users ask about network status, health, metrics, or stats.',
    parameters: z.object({}),
    handler: async (algorand) => getNetworkStatus(algorand),
  },
  {
    name: 'lookup_block',
    description:
      'Look up a block by its round number. If no round is provided, returns the latest block.',
    parameters: z.object({
      round: z.number().optional().describe('The round number of the block (omit for latest)'),
    }),
    handler: async (algorand, args) => lookupBlock(algorand, args),
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
    handler: async (algorand, args) => searchBlockHeaders(algorand, args),
  },
]
