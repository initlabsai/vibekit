import {
  createPaymentFlowViewModel,
  type ResultStore,
  type ViewSpec,
  type WriteFlowState,
} from '@initlabs/vibekit-experience'
import { createTextAttributes, type BoxRenderable, type MouseEvent, type ScrollBoxRenderable } from '@opentui/core'
import { useEffect, useState, type RefObject } from 'react'

import type { NfdRecord } from '@initlabs/vibekit-plugin-nfd'

import { NfdCard, PaymentCard } from './cards/index.js'
import { COLORS, shorten, wrapLines } from './theme.js'
import { Button } from './ui.js'
import { RawCard, ResultView, type OpenTarget } from './views.js'

/** One rendered result inside a section — a request may compose several. */
export type SectionBlock =
  | { id: number; kind: 'view'; view: ViewSpec }
  | { id: number; kind: 'raw'; title: string; text: string }
  | { id: number; kind: 'nfd'; data: NfdRecord; network: string }
  | { id: number; kind: 'payment'; flow: WriteFlowState }

/** One entry in a section's body, in arrival order. */
export type SectionItem =
  | { id: number; kind: 'note'; text: string; tone: 'muted' | 'error' | 'agent' }
  | { id: number; kind: 'block'; block: SectionBlock }

/**
 * Everything one request produced: the model's narration, the rendered
 * cards, and any errors, in order. The nav pane is this list's index.
 */
export interface Section {
  id: number
  /** The user request, shown in the nav and as the section header. */
  prompt: string
  items: SectionItem[]
  /** Model reasoning for this request; folded by default. */
  thinking?: string
  thinkingOpen?: boolean
}

function promptKicker(prompt: string, width: number, selected: boolean): string {
  return shorten(`${selected ? '▸' : '›'} ${prompt}`, Math.max(8, width))
}

function promptRule(width: number, selected: boolean): string {
  return (selected ? '━' : '─').repeat(Math.max(4, width))
}

const SPINNER = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

function ThinkingSpinner() {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setFrame((n) => n + 1), 80)
    return () => clearInterval(id)
  }, [])
  return (
    <text fg={COLORS.brass} content={SPINNER[frame % SPINNER.length]!} />
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
        <text
          fg={COLORS.muted}
          marginTop={1}
          content={wrapLines(text, width).join('\n')}
        />
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

const WELCOME_QUESTIONS = ["look up vibekit.algo on mainnet"] as const
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
      title=" SESSION "
      titleColor={COLORS.faint}
      backgroundColor={COLORS.background}
    >
      <scrollbox flexGrow={1} stickyScroll stickyStart="bottom">
        {sections.map((section, index) => {
          const selected = section.id === selectedId
          return (
            <box
              key={section.id}
              height={1}
              paddingX={1}
              backgroundColor={selected ? COLORS.panelRaised : undefined}
              onMouseDown={() => onSelect(section.id)}
            >
              <text
                fg={selected ? COLORS.brassBright : COLORS.text}
                content={shorten(
                  `${selected ? '▸' : ' '}${index + 1} ${section.prompt}`,
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
}) {
  // border 2 + scrollbox padding 2 + gutter 1 + its gap 1
  const innerWidth = Math.max(24, width - 6)
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
                {/* Hairline + one-step tint: the selection stays visible however far
                    you scroll without shouting. A left-only border is a true 1/8-cell rule. */}
                <box
                  flexDirection="column"
                  flexGrow={1}
                  paddingLeft={1}
                  border={['left']}
                  borderStyle={selected ? 'heavy' : 'single'}
                  borderColor={selected ? COLORS.brass : COLORS.borderSoft}
                  backgroundColor={selected ? COLORS.panel : undefined}
                >
                <box flexDirection="row" justifyContent="space-between" height={1}>
                  <text
                    fg={selected ? COLORS.brassBright : COLORS.faint}
                    content={promptKicker(section.prompt, innerWidth - 4, selected)}
                  />
                  <Button label="✕" onPress={() => onClose(section.id)} />
                </box>
                <text
                  fg={selected ? COLORS.brass : COLORS.borderSoft}
                  content={promptRule(innerWidth, selected)}
                />
                {section.items.map((item) => {
                  if (item.kind === 'note') {
                    const color =
                      item.tone === 'error'
                        ? COLORS.red
                        : item.tone === 'agent'
                          ? COLORS.text
                          : COLORS.muted
                    return (
                      <text
                        key={item.id}
                        marginTop={1}
                        fg={color}
                        content={wrapLines(item.text, innerWidth).join('\n')}
                      />
                    )
                  }
                  const block = item.block
                  if (block.kind === 'view') {
                    return (
                      <ResultView
                        key={item.id}
                        store={store}
                        view={block.view}
                        width={cardWidth}
                        maxAssets={20}
                        onOpen={onOpen}
                        onMore={() => onMore(section.id, item.id, block.view)}
                        loadingMore={loadingMoreItemId === item.id}
                      />
                    )
                  }
                  if (block.kind === 'raw') {
                    return (
                      <RawCard key={item.id} title={block.title} text={block.text} width={cardWidth} />
                    )
                  }
                  if (block.kind === 'nfd') {
                    const address = block.data.address
                    return (
                      <NfdCard
                        key={item.id}
                        data={block.data}
                        network={block.network}
                        width={cardWidth}
                        onOpenAccount={address ? () => onOpen({ kind: 'account', address }) : undefined}
                      />
                    )
                  }
                  const derived = createPaymentFlowViewModel(store, block.flow)
                  return (
                    <PaymentCard
                      key={`${item.id}-${block.flow.stage}`}
                      model={derived.ok ? derived.model : undefined}
                      stage={block.flow.stage}
                      busy={busyPayment}
                      width={cardWidth}
                    />
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
        </scrollbox>
      )}
    </box>
  )
}
