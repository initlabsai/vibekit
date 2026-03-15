import type { AlgorandClient } from '@algorandfoundation/algokit-utils'

const MICROALGOS_PER_ALGO = 1_000_000

interface FormattedBlock {
  round: number
  timestamp: number
  transactionCount: number
  proposer?: string
  feesCollected?: number
  proposerPayout?: number
  previousBlockHash?: string
  seed?: string
}

/** Look up a block by round. If no round provided, fetches latest from Algod. */
export async function lookupBlock(
  algorand: AlgorandClient,
  args: { round?: number }
): Promise<FormattedBlock> {
  const indexer = algorand.client.indexer
  const round = args.round ?? Number((await algorand.client.algod.status().do()).lastRound)
  const response = await indexer.lookupBlock(round).do()
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
      ? Buffer.from(response.previousBlockHash).toString('base64')
      : undefined,
    seed: response.seed ? Buffer.from(response.seed).toString('base64') : undefined,
  }
}
