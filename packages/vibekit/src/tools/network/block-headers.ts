import { DEFAULT_LIMIT, stripFinalToken, type ToolContext } from '../../core/index.js'
import { typeCounts } from './block.js'

export interface SearchBlockHeadersArgs {
  limit?: number
  nextToken?: string
  minRound?: number
  maxRound?: number
  beforeTime?: string
  afterTime?: string
}

export async function searchBlockHeaders(ctx: ToolContext, args: SearchBlockHeadersArgs) {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = ctx.indexer.searchForBlockHeaders().limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.minRound) query = query.minRound(args.minRound)
  if (args.maxRound) query = query.maxRound(args.maxRound)
  if (args.beforeTime) query = query.beforeTime(args.beforeTime)
  if (args.afterTime) query = query.afterTime(args.afterTime)

  const response = await query.do()

  // Headers carry no transactions, only the ledger's running txnCounter; a
  // block's count is the step from the round before it when that round is on the page.
  const headers = (response.blocks ?? []).map((block) => ({
    round: Number(block.round),
    timestamp: Number(block.timestamp),
    counter: block.txnCounter === undefined ? undefined : Number(block.txnCounter),
    proposer: block.proposer?.toString(),
    transactions: block.transactions ?? [],
  }))
  const counterByRound = new Map(headers.map((header) => [header.round, header.counter]))
  const blocks = headers.map(({ round, timestamp, counter, proposer, transactions }) => {
    const previous = counterByRound.get(round - 1)
    const fromCounter =
      counter !== undefined && previous !== undefined ? counter - previous : undefined
    return {
      round,
      timestamp,
      transactionCount: transactions.length > 0 ? transactions.length : (fromCounter ?? 0),
      ...(transactions.length > 0 ? { transactionTypes: typeCounts(transactions) } : {}),
      proposer,
    }
  })

  return {
    blocks,
    nextToken: stripFinalToken(blocks.length, limit, response.nextToken),
  }
}
