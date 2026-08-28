import { z } from 'zod'
import { microAlgos, optionalMicroAlgos } from '../shared/schemas.js'

const blockSummary = z.object({
  round: z.number(),
  timestamp: z.number(),
  transactionCount: z.number(),
  proposer: z.string().optional(),
  transactionTypes: z.array(z.object({ type: z.string(), count: z.number().int().nonnegative() })).optional(),
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
  totalSupplyMicroAlgos: microAlgos('Total supply'),
  onlineStakeMicroAlgos: microAlgos('Online stake'),
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
  feesCollectedMicroAlgos: optionalMicroAlgos('Fees collected'),
  proposerPayoutMicroAlgos: optionalMicroAlgos('Proposer payout'),
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
