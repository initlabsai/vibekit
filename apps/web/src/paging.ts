/** The page after a stored list record, merged into one record; undefined when the record is final. */
import { loadNextPage, type ResultStore, type StructuredResult, type ViewSpec } from '@initlabs/vibekit-explorer'

import type { ExplorerHost } from './features/network/hooks'

export function nextPageOf(args: {
  host: ExplorerHost
  store: ResultStore
  view: ViewSpec
  network: string
}): Promise<StructuredResult | undefined> {
  return loadNextPage({
    host: args.host,
    current: args.store.find((record) => record.resultId === args.view.source.id),
    view: args.view.view,
    identity: {
      resultId: `result-page-${crypto.randomUUID()}`,
      toolCallId: `tool-call-page-${crypto.randomUUID()}`,
      network: args.network,
    },
  })
}
