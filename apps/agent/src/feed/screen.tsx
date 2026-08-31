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
      // The POST consumes the tap's transient activation, so a later writeText is denied on
      // iOS Safari. Hand the clipboard the pending link instead, while the tap still counts.
      const link = (async () => {
        const response = await fetch('/api/share', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
        if (!response.ok || !body.url) throw new Error(body.error ?? `(${response.status})`)
        return new URL(body.url, window.location.origin).toString()
      })()
      try {
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
          const text = link.then((url) => new Blob([url], { type: 'text/plain' }))
          await navigator.clipboard.write([new ClipboardItem({ 'text/plain': text })])
        } else {
          await navigator.clipboard?.writeText(await link)
        }
        const url = await link
        // The sheet is a bonus on touch — the link is already on the clipboard either way.
        if (typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches) {
          await navigator.share({ title: 'qt314', url }).catch(() => {})
        }
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
          provider={agent.provider}
          providerUrl={agent.providerUrl}
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
