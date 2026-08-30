import type { ResultStore, ViewSpec } from '@initlabs/vibekit/actions'

import { Button } from '../../primitives.js'
import { ResultCard, type OpenTarget } from '../../result-card.js'
import { COLORS, shorten } from '../../theme.js'

/** Live block tail: only fetches while this page is open and not paused. */
export function BlocksScreen({
  network,
  live,
  running,
  paused,
  latestRound,
  error,
  store,
  views,
  width,
  onToggle,
  onOpen,
  keys,
}: {
  /** Key hints for this screen, drawn in the bottom frame line. */
  keys: string
  network: string
  live: 'probing' | boolean
  running: boolean
  paused: boolean
  latestRound?: number
  error?: string
  store: ResultStore
  views: readonly ViewSpec[]
  width: number
  onToggle: () => void
  onOpen: (target: OpenTarget) => void
}) {
  const inner = Math.max(30, width - 6)
  const pill =
    live === 'probing'
      ? 'probing…'
      : live !== true
        ? 'sample — no tail'
        : running
          ? 'LIVE'
          : paused
            ? 'STOPPED'
            : 'idle'
  return (
    <box
      flexGrow={1}
      flexDirection="column"
      padding={1}
      border
      borderStyle={running ? 'heavy' : 'single'}
      borderColor={running ? COLORS.brass : COLORS.border}
      title={` BLOCKS · ${pill} · ${network}${latestRound === undefined ? '' : ` · ${latestRound}`} `}
      titleColor={running ? COLORS.signal : COLORS.brassBright}
      bottomTitle={` ${shorten(keys, Math.max(8, width - 6))} `}
      bottomTitleAlignment="right"
      backgroundColor={COLORS.background}
    >
      {live === true ? (
        <box flexDirection="row" height={1}>
          <Button label={running ? '■ stop' : '▶ start'} onPress={onToggle} active={running} />
        </box>
      ) : null}
      {live !== true ? (
        <text
          fg={COLORS.muted}
          marginTop={1}
          content="Need a live network for the tail. ^n to switch, then open this page again."
        />
      ) : error ? (
        <text fg={COLORS.brassBright} marginTop={1} content={error} />
      ) : views.length === 0 ? (
        <text
          fg={COLORS.faint}
          marginTop={1}
          content={running ? 'Waiting for the next block…' : 'space starts the tail.'}
        />
      ) : (
        <scrollbox flexGrow={1} marginTop={1} stickyScroll stickyStart="top">
          {/* Newest block on top: the tail reads like a ticker, not a log. */}
          {views
            .map((view, index) => (
              <ResultCard
                key={`${view.source.id}-${index}`}
                store={store}
                view={view}
                width={inner}
                onOpen={onOpen}
              />
            ))
            .reverse()}
        </scrollbox>
      )}
    </box>
  )
}
