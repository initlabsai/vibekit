import type algosdk from 'algosdk'
import { formatBlock } from '../formatters'
import type { FormattedBlock } from '../types'
import { DEFAULT_LIMIT } from '../types'

export interface LookupBlockArgs {
  round: number
}

export async function lookupBlock(
  indexer: algosdk.Indexer,
  args: LookupBlockArgs
): Promise<FormattedBlock> {
  const response = await indexer.lookupBlock(args.round).do()
  return formatBlock(response)
}

export interface SearchBlockHeadersArgs {
  limit?: number
  nextToken?: string
  minRound?: number
  maxRound?: number
  beforeTime?: string
  afterTime?: string
}

export async function searchBlockHeaders(
  indexer: algosdk.Indexer,
  args: SearchBlockHeadersArgs
): Promise<{ blocks: Array<Record<string, unknown>>; nextToken?: string }> {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  let query = indexer.searchForBlockHeaders().limit(limit)

  if (args.nextToken) query = query.nextToken(args.nextToken)
  if (args.minRound) query = query.minRound(args.minRound)
  if (args.maxRound) query = query.maxRound(args.maxRound)
  if (args.beforeTime) query = query.beforeTime(args.beforeTime)
  if (args.afterTime) query = query.afterTime(args.afterTime)

  const response = await query.do()

  return {
    blocks: (response.blocks ?? []).map((block) => ({
      round: Number(block.round),
      timestamp: Number(block.timestamp),
      transactionCount: block.transactions?.length ?? 0,
      proposer: block.proposer?.toString(),
    })),
    nextToken: response.nextToken,
  }
}
