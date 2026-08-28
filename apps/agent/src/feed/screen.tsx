'use client'

/** `/`: the transcript. */
import { useExplorer } from '../explorer'
import { Welcome } from '../views'
import { FeedPane } from './feed'

export function FeedScreen() {
  const { feed, renderBlock, submit, setStatus, agent } = useExplorer()
  return (
    <FeedPane
      sections={feed.sections}
      selectedId={feed.selectedId}
      renderBlock={renderBlock}
      onToggle={feed.toggleCollapsed}
      streamingSection={agent.streamingSection}
      empty={
        <Welcome
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
