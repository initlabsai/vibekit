import { DEFAULT_LIMIT, stripFinalToken, type ToolContext } from '../../../core/index.js'

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

  const blocks = (response.blocks ?? []).map((block) => ({
    round: Number(block.round),
    timestamp: Number(block.timestamp),
    transactionCount: block.transactions?.length ?? 0,
    proposer: block.proposer?.toString(),
  }))

  return {
    blocks,
    nextToken: stripFinalToken(blocks.length, limit, response.nextToken),
  }
}
