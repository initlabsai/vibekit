import { bytesToBase64, type ToolContext } from '@initlabs/vibekit-core'

const MICROALGOS_PER_ALGO = 1_000_000

type IndexerTxn = {
  txType?: string
}

function typeCounts(raw: IndexerTxn[]): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>()
  const order: string[] = []
  for (const tx of raw) {
    const type = tx.txType && tx.txType.length > 0 ? tx.txType : 'other'
    if (!counts.has(type)) order.push(type)
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  return order.map((type) => ({ type, count: counts.get(type)! }))
}

/** Look up a block by round. If no round provided, fetches latest from algod. */
export async function lookupBlock(ctx: ToolContext, args: { round?: number }) {
  const round = args.round ?? Number((await ctx.algod.status().do()).lastRound)
  const response = await ctx.indexer.lookupBlock(round).do()
  const raw = (response.transactions ?? []) as IndexerTxn[]
  return {
    round: Number(response.round),
    timestamp: Number(response.timestamp),
    transactionCount: raw.length,
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
    transactionTypes: typeCounts(raw),
  }
}
