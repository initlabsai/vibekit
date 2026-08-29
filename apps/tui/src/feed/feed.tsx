/**
 * The transcript: the session index (NavPane), the results feed (ContentPane)
 * with its welcome panel and thinking fold, and the composer input.
 */
import {
  createWriteFlowViewModel,
  type ResultStore,
  type ViewSpec,
} from '@initlabs/vibekit-explorer'
import {
  createTextAttributes,
  type BoxRenderable,
  type InputRenderable,
  type MouseEvent,
  type ScrollBoxRenderable,
  type SubmitEvent as OpenTUISubmitEvent,
} from '@opentui/core'
import { useEffect, useState, type RefObject } from 'react'

import { WriteFlowCard } from '../features/write-flow/cards.js'
import { RawCard, TableCard } from '../generic-cards.js'
import { HighlightContext, usePulse } from '../primitives.js'
import { ResultCard, type OpenTarget } from '../result-card.js'
import { COLORS, shorten, wrapLines } from '../theme.js'
import type { Section } from './hooks.js'

function promptKicker(prompt: string, width: number, selected: boolean): string {
  return shorten(`${selected ? '▸' : '›'} ${prompt}`, Math.max(8, width))
}

const SPINNER = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

function ThinkingSpinner() {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setFrame((n) => n + 1), 80)
    return () => clearInterval(id)
  }, [])
  return <text fg={COLORS.brass} content={SPINNER[frame % SPINNER.length]!} />
}

/** An arc that turns: the direct lane at work, in the live color. Thinking keeps the braille dots. */
const ARC = '◜◠◝◞◡◟'

function FetchLine({ text, width }: { text: string; width: number }) {
  const frame = usePulse(540, ARC.length)
  // Work in progress ends with an ellipsis; plain feedback (copied …) just sits.
  const working = text.endsWith('…')
  return (
    <box flexDirection="row" height={1} marginTop={1}>
      {working ? <text fg={COLORS.signal}>{`${ARC[frame]} `}</text> : null}
      <text
        fg={working ? COLORS.signal : COLORS.muted}
        content={shorten(text, Math.max(8, width - 2))}
      />
    </box>
  )
}

function thinkingSize(text: string): string {
  if (text.length < 1000) return String(text.length)
  return `${(text.length / 1000).toFixed(1).replace(/\.0$/, '')}k`
}

/** Folded by default; click to dump the reasoning stream. */
export function ThinkingFold({
  text,
  expanded,
  live,
  width,
  onToggle,
}: {
  text: string
  expanded: boolean
  live: boolean
  width: number
  onToggle: () => void
}) {
  const arrow = expanded ? '▾' : '▸'
  const size = !expanded && text.length > 0 ? `  ${thinkingSize(text)}` : ''
  return (
    <box flexDirection="column" marginTop={1}>
      {/* Only the header toggles: a drag across the text is a copy, not a fold. */}
      <box flexDirection="row" height={1} live={live} onMouseDown={onToggle}>
        <text fg={COLORS.faint}>{`${arrow} `}</text>
        {live ? <ThinkingSpinner /> : null}
        <text fg={COLORS.faint}>{live ? ' thinking' : 'thoughts'}</text>
        {size ? <text fg={COLORS.borderSoft}>{size}</text> : null}
      </box>
      {expanded && text.length > 0 ? (
        <text fg={COLORS.muted} marginTop={1} content={wrapLines(text, width).join('\n')} />
      ) : null}
    </box>
  )
}

const WELCOME_COMMANDS: ReadonlyArray<[string, string]> = [
  ['paste an id', 'address, txn, group, asset/app/block number, name.algo'],
  ['pay 0.5 to alice', 'from the active sender: compose, simulate, inspect, approve, sign'],
  ['list my accounts', 'keystore accounts, live balances; ^w switches sender'],
  ['^1 ^2 ^3 ^4', 'assets · apps (simulate read methods) · txns · live blocks'],
  ['^n', 'localnet · testnet · mainnet'],
]

const WELCOME_QUESTIONS = ['look up vibekit.algo on mainnet'] as const
const LINK_ATTR = createTextAttributes({ underline: true })

/** Empty-feed invite: what works, and what this is (tool calls, not magic). */
export function WelcomePanel({
  hasAgent,
  width,
  onSuggest,
}: {
  hasAgent: boolean
  width: number
  /** Puts an example question in the composer, ready to edit or send. */
  onSuggest: (text: string) => void
}) {
  return (
    <box flexGrow={1} padding={2} flexDirection="column">
      {width >= 60 ? (
        <ascii-font font="tiny" text="VIBEKIT" color={[COLORS.brassBright, COLORS.signal]} />
      ) : (
        <text fg={COLORS.brassBright}>VIBEKIT</text>
      )}
      <text fg={COLORS.faint}>explorer</text>
      <text
        fg={COLORS.muted}
        marginTop={2}
        content="Algorand, by conversation. Every card is real chain data; the agent only narrates what the tools return."
      />
      <box flexDirection="column" marginTop={2}>
        {WELCOME_COMMANDS.map(([command, hint]) => (
          <box key={command} flexDirection="row" height={1}>
            <text fg={COLORS.text}>{`  ${command.padEnd(19)}`}</text>
            <text fg={COLORS.faint}>{hint}</text>
          </box>
        ))}
      </box>
      {hasAgent ? (
        <box flexDirection="column" marginTop={2}>
          {WELCOME_QUESTIONS.map((question) => (
            <box key={question} flexDirection="row" height={1}>
              <text fg={COLORS.muted}>{'  "'}</text>
              <text
                fg={COLORS.brassBright}
                attributes={LINK_ATTR}
                content={question}
                onMouseDown={(event: MouseEvent) => {
                  event.stopPropagation()
                  onSuggest(question)
                }}
              />
              <text fg={COLORS.muted}>"</text>
            </box>
          ))}
          <text
            fg={COLORS.faint}
            marginTop={1}
            content="Not magic: each answer is an indexer or algod lookup. Specific beats sweeping — give it an id, a round, a name, and it does the rest."
          />
        </box>
      ) : (
        <text
          fg={COLORS.faint}
          marginTop={2}
          content="set VIBEKIT_AGENT_MODEL to chat  (or run: vibekit explore setup)"
        />
      )}
    </box>
  )
}

/** The session index: one line per request; click or ↑/↓ + enter to jump. */
export function NavPane({
  sections,
  selectedId,
  width,
  onSelect,
}: {
  sections: Section[]
  selectedId: number | null
  width: number
  onSelect: (id: number) => void
}) {
  return (
    <box
      width={width}
      flexDirection="column"
      border
      borderStyle="single"
      borderColor={COLORS.border}
      title=" SESSION ^s "
      titleColor={COLORS.faint}
      backgroundColor={COLORS.background}
    >
      <scrollbox flexGrow={1} stickyScroll stickyStart="bottom">
        {sections.map((section, index) => {
          const selected = section.id === selectedId
          return (
            <box key={section.id} height={1} paddingX={1} onMouseDown={() => onSelect(section.id)}>
              <text
                fg={selected ? COLORS.brassBright : COLORS.muted}
                content={shorten(
                  `${selected ? '▸' : ' '}${String(index + 1).padStart(String(sections.length).length)} ${section.prompt}`,
                  Math.max(8, width - 4),
                )}
              />
            </box>
          )
        })}
      </scrollbox>
    </box>
  )
}

/**
 * The results feed: every section in chronological order — prompt divider,
 * narration, cards. New groups accrete at the bottom (sticky); the session
 * index and ←/→ still jump a group into view.
 */
export function ContentPane({
  sections,
  selectedId,
  store,
  focused,
  busyPayment,
  liveThinkingSectionId,
  hasAgent,
  keys,
  width,
  scrollRef,
  sectionRegistry,
  onSelect,
  onToggleThinking,
  onOpen,
  onClose,
  onMore,
  onSuggest,
  loadingMoreItemId,
  cursorItemId,
  cardRegistry,
  onSelectItem,
  status,
}: {
  sections: Section[]
  selectedId: number | null
  store: ResultStore
  focused: boolean
  busyPayment: boolean
  /** Section currently streaming reasoning, if any. */
  liveThinkingSectionId?: number | null
  hasAgent: boolean
  /** Key hints for the current focus, shown in the bottom frame line. */
  keys: string
  width: number
  scrollRef: RefObject<ScrollBoxRenderable | null>
  /** Section renderables by id, for top-aligned jumps. */
  sectionRegistry: RefObject<Map<number, BoxRenderable>>
  onSelect: (id: number) => void
  onToggleThinking: (id: number) => void
  onOpen: (target: OpenTarget) => void
  onClose: (id: number) => void
  onMore: (sectionId: number, itemId: number, view: ViewSpec) => void
  onSuggest: (text: string) => void
  /** Item id of the list currently fetching its next page. */
  loadingMoreItemId: number | null
  /** The highlighted card; its frame turns amber and keys act on it. */
  cursorItemId: number | null
  /** Card renderables by item id, for ←/→ scrolling. */
  cardRegistry: RefObject<Map<number, BoxRenderable>>
  /** A click on a card highlights it. */
  onSelectItem: (sectionId: number, itemId: number) => void
  /** What the app is doing right now (a lookup, a tool call, a copy); empty when idle. */
  status: string
}) {
  // border 2 + scrollbox padding 2 + gutter 1 + its gap 1
  const innerWidth = Math.max(24, width - 6)
  // The cursor at the end of streaming narration blinks at terminal pace.
  const cursorOn = usePulse(1000, 2) === 0
  const cardWidth = Math.max(30, innerWidth - 2)
  // Entering chat (this pane mounts) lands on the newest content.
  useEffect(() => {
    const id = setTimeout(() => {
      const scroll = scrollRef.current
      if (scroll) scroll.scrollTo({ x: 0, y: scroll.scrollHeight })
    }, 0)
    return () => clearTimeout(id)
  }, [scrollRef])
  return (
    <box
      flexGrow={1}
      flexDirection="column"
      border
      borderStyle={focused ? 'heavy' : 'single'}
      borderColor={focused ? COLORS.brass : COLORS.border}
      title=" FEED "
      titleColor={focused ? COLORS.brassBright : COLORS.faint}
      bottomTitle={` ${shorten(keys, Math.max(8, width - 6))} `}
      bottomTitleAlignment="right"
      backgroundColor={COLORS.background}
    >
      {sections.length === 0 ? (
        <WelcomePanel hasAgent={hasAgent} width={innerWidth} onSuggest={onSuggest} />
      ) : (
        <scrollbox ref={scrollRef} flexGrow={1} paddingX={1} stickyScroll stickyStart="bottom">
          {sections.map((section) => {
            const selected = section.id === selectedId
            return (
              <box
                key={section.id}
                flexDirection="row"
                marginTop={1}
                onMouseDown={() => {
                  // Mark the group only. Scrolling here would jump the
                  // viewport when the user is starting a text selection.
                  onSelect(section.id)
                }}
                ref={(renderable: BoxRenderable | null) => {
                  if (renderable) sectionRegistry.current.set(section.id, renderable)
                  else sectionRegistry.current.delete(section.id)
                }}
              >
                <box flexDirection="column" flexGrow={1}>
                  <box flexDirection="row" justifyContent="space-between" height={1}>
                    <text
                      fg={selected ? COLORS.brass : COLORS.faint}
                      content={promptKicker(section.prompt, innerWidth - 4, selected)}
                    />
                    <text
                      fg={COLORS.faint}
                      content="close ×"
                      onMouseDown={(event: MouseEvent) => {
                        event.stopPropagation()
                        onClose(section.id)
                      }}
                    />
                  </box>
                  {section.items.map((item, index) => {
                    if (item.kind === 'note') {
                      const color =
                        item.tone === 'error'
                          ? COLORS.brassBright
                          : item.tone === 'agent'
                            ? COLORS.text
                            : COLORS.muted
                      const streaming =
                        item.tone === 'agent' &&
                        liveThinkingSectionId === section.id &&
                        index === section.items.length - 1
                      const cursor = streaming && cursorOn ? '▌' : streaming ? ' ' : ''
                      return (
                        <text
                          key={item.id}
                          marginTop={1}
                          fg={color}
                          content={wrapLines(item.text + cursor, innerWidth).join('\n')}
                        />
                      )
                    }
                    const block = item.block
                    const card =
                      block.kind === 'view' ? (
                        <ResultCard
                          store={store}
                          view={block.view}
                          width={cardWidth}
                          onOpen={onOpen}
                          onMore={() => onMore(section.id, item.id, block.view)}
                          loadingMore={loadingMoreItemId === item.id}
                        />
                      ) : block.kind === 'raw' ? (
                        <RawCard title={block.title} text={block.text} width={cardWidth} />
                      ) : block.kind === 'table' ? (
                        <TableCard
                          title={block.title}
                          facts={block.facts}
                          rows={block.rows}
                          width={cardWidth}
                        />
                      ) : (
                        <WriteFlowCard
                          key={block.flow.stage}
                          model={(() => {
                            const derived = createWriteFlowViewModel(store, block.flow)
                            return derived.ok ? derived.model : undefined
                          })()}
                          stage={block.flow.stage}
                          busy={busyPayment}
                          width={cardWidth}
                        />
                      )
                    return (
                      <box
                        key={item.id}
                        flexDirection="column"
                        ref={(renderable: BoxRenderable | null) => {
                          if (renderable) cardRegistry.current.set(item.id, renderable)
                          else cardRegistry.current.delete(item.id)
                        }}
                        onMouseDown={(event: MouseEvent) => {
                          // The click highlights the card; a drag still selects text.
                          event.stopPropagation()
                          onSelectItem(section.id, item.id)
                        }}
                      >
                        <HighlightContext.Provider value={cursorItemId === item.id}>
                          {card}
                        </HighlightContext.Provider>
                      </box>
                    )
                  })}
                  {(section.thinking && section.thinking.length > 0) ||
                  liveThinkingSectionId === section.id ? (
                    <ThinkingFold
                      text={section.thinking ?? ''}
                      expanded={section.thinkingOpen === true}
                      live={liveThinkingSectionId === section.id}
                      width={innerWidth}
                      onToggle={() => onToggleThinking(section.id)}
                    />
                  ) : null}
                </box>
              </box>
            )
          })}
          {status ? <FetchLine text={status} width={innerWidth} /> : null}
        </scrollbox>
      )}
    </box>
  )
}

/** The single input line at the bottom of the chat screen. */
export function Composer({
  epoch,
  focused,
  hint,
  inputRef,
  onFocus,
  onSubmit,
}: {
  epoch: number
  focused: boolean
  hint: string
  inputRef: RefObject<InputRenderable | null>
  /** A click on the composer claims app focus, like esc does from the feed. */
  onFocus: () => void
  onSubmit: (value: string) => void
}) {
  // OpenTUI's intrinsic type currently intersects its core SubmitEvent prop
  // with the React adapter's string callback; runtime behavior is the latter.
  const submitHandler = onSubmit as unknown as ((event: OpenTUISubmitEvent) => void) &
    ((value: string) => void)

  return (
    <box
      height={3}
      flexDirection="row"
      alignItems="center"
      paddingX={1}
      border
      borderStyle={focused ? 'heavy' : 'single'}
      borderColor={focused ? COLORS.brass : COLORS.border}
      onMouseDown={onFocus}
    >
      <text fg={focused ? COLORS.brassBright : COLORS.faint}>❯ </text>
      {/* Remount per submit: the input keeps its own buffer, so a fresh key is
          the only reliable way to clear it. */}
      <input
        key={epoch}
        ref={inputRef}
        flexGrow={1}
        focused={focused}
        placeholder={hint}
        onSubmit={submitHandler}
      />
    </box>
  )
}
