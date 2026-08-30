/** One record a screen owns outside the transcript: fetched on demand, paged in place. */
import { addResult, type StructuredResult, type TrustedViewId, type ViewSpec } from '@initlabs/vibekit/views'
import { useCallback, useState } from 'react'

import { useExplorer } from './explorer'
import { viewFor } from './lookup'
import { nextPageOf } from './paging'
import { errorMessage } from './theme'

export function useScreenRecord() {
  const { storeRef, commitStore, host, network } = useExplorer()
  const [view, setView] = useState<ViewSpec | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const run = useCallback(
    async (viewId: TrustedViewId, fetch: () => Promise<StructuredResult>) => {
      setLoading(true)
      setError(undefined)
      try {
        const record = await fetch()
        commitStore(addResult(storeRef.current, record))
        setView(viewFor(record, viewId))
      } catch (caught) {
        setView(undefined)
        setError(errorMessage(caught))
      } finally {
        setLoading(false)
      }
    },
    [commitStore, storeRef],
  )

  const more = useCallback(async () => {
    if (!view || loadingMore) return
    setLoadingMore(true)
    try {
      const merged = await nextPageOf({ host: host(), store: storeRef.current, view, network })
      if (!merged) return
      commitStore(addResult(storeRef.current, merged))
      setView(viewFor(merged, view.view))
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoadingMore(false)
    }
  }, [commitStore, host, loadingMore, network, storeRef, view])

  return { view, error, loading, loadingMore, run, more, clear: () => setView(undefined) }
}
