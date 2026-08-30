import type { TrustedViewId } from '../actions/index.js'
import type { ResultIdentity, StructuredResult } from '../actions/index.js'
import type { ToolCallHost } from './host.js'
import { createRecord } from './derive.js'

/** The array a paged list view renders; the next page's rows append to it. */
const LIST_KEYS: Partial<Record<TrustedViewId, string>> = {
  'transaction.list': 'transactions',
  'account.list': 'accounts',
  'asset.list': 'assets',
  'asset.holdings': 'assets',
  'asset.holders': 'balances',
  'application.list': 'applications',
  'application.locals': 'apps',
  'application.logs': 'logData',
  'block.list': 'blocks',
  'arcade.markets': 'markets',
}

/**
 * The arguments that fetch the page after `result`: the call that produced
 * it plus its nextToken. Undefined when the record is final, failed, or
 * does not know its own call.
 */
export function nextPageArgs(
  result: StructuredResult | undefined,
): Record<string, unknown> | undefined {
  if (!result || result.state !== 'success') return undefined
  const data = result.data
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return undefined
  const nextToken = (data as { nextToken?: unknown }).nextToken
  if (typeof nextToken !== 'string' || nextToken.length === 0) return undefined
  const input = result.input
  if (input === undefined || input === null || typeof input !== 'object' || Array.isArray(input))
    return undefined
  return { ...input, nextToken }
}

/** One record holding both pages: rows concatenated, the newer page's token kept, the first call remembered. */
export function mergePages(
  view: TrustedViewId,
  first: StructuredResult,
  next: StructuredResult,
  identity: ResultIdentity,
): StructuredResult {
  const key = LIST_KEYS[view]
  if (!key) throw new Error(`View ${view} is not a paged list`)
  if (first.state !== 'success' || next.state !== 'success')
    throw new Error('Cannot merge a failed page')
  const a = first.data as Record<string, unknown>
  const b = next.data as Record<string, unknown>
  const rows = [...((a[key] as unknown[]) ?? []), ...((b[key] as unknown[]) ?? [])]
  const { nextToken: _first, ...rest } = a
  return createRecord(
    { ...identity, ...(first.input === undefined ? {} : { input: first.input }) },
    first.toolName,
    {
      ...rest,
      [key]: rows,
      ...(typeof b.nextToken === 'string' && b.nextToken ? { nextToken: b.nextToken } : {}),
    },
  )
}

/**
 * Fetches the page after `current` — the record's own call with its
 * nextToken, through the host — and returns one record holding both pages,
 * or undefined when the record is final. Any paged list, any tool.
 */
export async function loadNextPage(args: {
  host: ToolCallHost
  current: StructuredResult | undefined
  view: TrustedViewId
  identity: ResultIdentity
}): Promise<StructuredResult | undefined> {
  const next = nextPageArgs(args.current)
  if (!args.current || !next) return undefined
  const page = await args.host.callTool(args.current.toolName, next)
  return mergePages(args.view, args.current, page, args.identity)
}

export type { ToolCallHost } from './host.js'
