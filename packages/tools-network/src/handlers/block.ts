import { bytesToBase64, type ToolContext } from '@initlabs/core'

const MICROALGOS_PER_ALGO = 1_000_000

/** Look up a block by round. If no round provided, fetches latest from algod. */
export async function lookupBlock(ctx: ToolContext, args: { round?: number }) {
  const round = args.round ?? Number((await ctx.algod.status().do()).lastRound)
  const response = await ctx.indexer.lookupBlock(round).do()
  return {
    round: Number(response.round),
    timestamp: Number(response.timestamp),
    transactionCount: response.transactions?.length ?? 0,
    proposer: response.proposer ? String(response.proposer) : undefined,
    feesCollected:
      response.feesCollected != null
        ? Number(response.feesCollected) / MICROALGOS_PER_ALGO
        : undefined,
    proposerPayout:
      response.proposerPayout != null
        ? Number(response.proposerPayout) / MICROALGOS_PER_ALGO
        : undefined,
    previousBlockHash: response.previousBlockHash
      ? bytesToBase64(response.previousBlockHash)
      : undefined,
    seed: response.seed ? bytesToBase64(response.seed) : undefined,
  }
}
