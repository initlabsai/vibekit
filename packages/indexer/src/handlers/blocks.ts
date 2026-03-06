import type algosdk from 'algosdk'
import { formatBlock } from '../formatters.js'
import type { FormattedBlock } from '../types.js'
import { DEFAULT_LIMIT } from '../types.js'

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

/**
 * Search block headers by round/time range.
 * Uses raw fetch since algosdk doesn't wrap the /v2/blocks endpoint.
 * Requires the indexer base URL to be extracted from the client.
 */
export async function searchBlockHeaders(
  _indexer: algosdk.Indexer,
  args: SearchBlockHeadersArgs,
  baseUrl: string,
  token?: string
): Promise<{ blocks: Array<Record<string, unknown>>; nextToken?: string }> {
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, 100)
  const url = new URL(`${baseUrl}/v2/blocks`)
  url.searchParams.set('limit', String(limit))

  if (args.nextToken) url.searchParams.set('next', args.nextToken)
  if (args.minRound) url.searchParams.set('min-round', String(args.minRound))
  if (args.maxRound) url.searchParams.set('max-round', String(args.maxRound))
  if (args.beforeTime) url.searchParams.set('before-time', args.beforeTime)
  if (args.afterTime) url.searchParams.set('after-time', args.afterTime)

  const headers: Record<string, string> = {}
  if (token) headers['X-Indexer-API-Token'] = token

  const resp = await fetch(url.toString(), { headers })
  const data = (await resp.json()) as Record<string, unknown>

  return {
    blocks: ((data['blocks'] as unknown[]) ?? []).map((b) => {
      const block = b as Record<string, unknown>
      return {
        round: block['round'],
        timestamp: block['timestamp'],
        transactionCount:
          (block['transactions'] as unknown[] | undefined)?.length ?? 0,
        proposer: block['proposer'],
      }
    }),
    nextToken: data['next-token'] as string | undefined,
  }
}
