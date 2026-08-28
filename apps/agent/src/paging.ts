/** The page after a stored list record, merged into one record; undefined when the record is final. */
import { loadNextPage, type ResultStore, type StructuredResult, type ViewSpec } from '@initlabs/vibekit-explorer'

import type { ExplorerHost } from './features/network/hooks'

export function nextPageOf(args: {
  host: ExplorerHost
  store: ResultStore
  view: ViewSpec
  network: string
}): Promise<StructuredResult | undefined> {
  const current = args.store.find((record) => record.resultId === args.view.source.id)
  // A page token belongs to the indexer that issued it; the card keeps its own network.
  if (current && current.network !== args.network) {
    return Promise.reject(new Error(`this list is from ${current.network}; switch back to page it`))
  }
  return loadNextPage({
    host: args.host,
    current,
    view: args.view.view,
    identity: {
      resultId: `result-page-${crypto.randomUUID()}`,
      toolCallId: `tool-call-page-${crypto.randomUUID()}`,
      network: args.network,
    },
  })
}
