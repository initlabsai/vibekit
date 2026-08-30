'use client'

/** `/`: the transcript. */
import { useCallback } from 'react'

import { useExplorer } from '../explorer'
import { payloadFor } from '../share'
import { errorMessage } from '../theme'
import { Welcome } from '../views'
import { FeedPane } from './feed'
import type { Section } from './hooks'

export function FeedScreen() {
  const { feed, renderBlock, submit, setStatus, agent, network, storeRef } = useExplorer()

  /** The exchange as a URL: POST the payload, copy the link, report on the status line. */
  const share = useCallback(
    async (section: Section): Promise<boolean> => {
      const payload = payloadFor(section, storeRef.current)
      if (!payload) {
        setStatus('nothing shareable there yet — she has to answer first.')
        return false
      }
      try {
        const response = await fetch('/api/share', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
        if (!response.ok || !body.url) {
          setStatus(body.error ?? `share failed (${response.status})`)
          return false
        }
        const url = new URL(body.url, window.location.origin).toString()
        await navigator.clipboard?.writeText(url)
        setStatus(`share link copied — ${url}`)
        return true
      } catch (error) {
        setStatus(`share failed — ${errorMessage(error)}`)
        return false
      }
    },
    [setStatus, storeRef],
  )

  return (
    <FeedPane
      sections={feed.sections}
      selectedId={feed.selectedId}
      renderBlock={renderBlock}
      onToggle={feed.toggleCollapsed}
      streamingSection={agent.streamingSection}
      onShare={share}
      empty={
        <Welcome
          network={network}
          onSubmit={(raw) =>
            raw.includes('<address>')
              ? setStatus('Type /pay 0.5 to <an address or wallet label> — a connected wallet signs it.')
              : submit(raw)
          }
        />
      }
    />
  )
}
