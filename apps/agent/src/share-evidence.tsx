'use client'

/**
 * The shared exchange's evidence as the real cards — the same 30-way switch
 * the feed renders, over a store built from the payload's records. No
 * handlers are passed, so every drill-in, pagination, and rerun affordance
 * simply is not there; the cards are stills. Record-derived URLs are gated
 * by safeHref inside the cards themselves, and text renders through React —
 * nothing here reaches the visitor's session or the model.
 */
import { useMemo } from 'react'

import { createResultStore, type ResultStore } from '@initlabs/vibekit/actions'

import { ResultCard } from './result-card'
import type { SharePayload } from './share'

export function ShareEvidence({ blocks }: { blocks: SharePayload['blocks'] }) {
  const store = useMemo<ResultStore>(() => {
    const seen = new Set<string>()
    const records = blocks
      .map((block) => block.record)
      .filter((record) => {
        if (seen.has(record.resultId) || seen.has(record.toolCallId)) return false
        seen.add(record.resultId)
        seen.add(record.toolCallId)
        return true
      })
    try {
      return createResultStore(records)
    } catch {
      return []
    }
  }, [blocks])
  return (
    <>
      {blocks.map((block, index) => (
        <div key={index} className="block">
          <ResultCard store={store} view={block.view} />
        </div>
      ))}
    </>
  )
}
