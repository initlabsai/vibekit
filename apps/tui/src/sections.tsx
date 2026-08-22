import {
  createPaymentFlowViewModel,
  type ResultStore,
  type ViewSpec,
  type WriteFlowState,
} from '@initlabs/vibekit-experience'
import type { BoxRenderable, ScrollBoxRenderable } from '@opentui/core'
import { useEffect, useState, type RefObject } from 'react'

import { PaymentCard, type AssetSort } from './cards/index.js'
import { COLORS, shorten, wrapLines } from './theme.js'
import { RawCard, ResultView } from './views.js'

/** One rendered result inside a section — a request may compose several. */
export type SectionBlock =
  | { id: number; kind: 'view'; view: ViewSpec }
  | { id: number; kind: 'raw'; title: string; text: string }
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
  sort: AssetSort
  /** transaction.group cards in this section: flow graph or row table. */
  flow: 'graph' | 'table'
  items: SectionItem[]
  /** Model reasoning for this request; folded by default. */
  thinking?: string
  thinkingOpen?: boolean
}

function promptKicker(prompt: string, width: number, selected: boolean): string {
  return shorten(`${selected ? '▌' : '›'} ${prompt}`, Math.max(8, width))
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
    <box flexDirection="column" marginTop={1} onMouseDown={onToggle}>
      <box flexDirection="row" height={1} live={live}>
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

const WELCOME_QUESTIONS = [
  'who holds asset 31566704',
  'what happened in round 64291911',
  'what does nf.algo hold',
] as const

/** Empty-feed invite: what works, and what this is (tool calls, not magic). */
export function WelcomePanel({ hasAgent, width }: { hasAgent: boolean; width: number }) {
  return (
    <box flexGrow={1} padding={2} flexDirection="column">
      {width >= 60 ? (
        <ascii-font font="tiny" text="VIBEKIT" color={COLORS.brassBright} />
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
              <text fg={COLORS.text}>{`  ${question}`}</text>
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
  focused,
  width,
  onSelect,
}: {
  sections: Section[]
  selectedId: number | null
  focused: boolean
  width: number
  onSelect: (id: number) => void
}) {
  return (
    <box
      width={width}
      flexDirection="column"
      border
      borderStyle={focused ? 'heavy' : 'single'}
      borderColor={focused ? COLORS.brass : COLORS.border}
      title=" SESSION "
      titleColor={focused ? COLORS.brassBright : COLORS.faint}
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
  navFocused,
  busyPayment,
  liveThinkingSectionId,
  hasAgent,
  width,
  scrollRef,
  sectionRegistry,
  onSelect,
  onToggleThinking,
}: {
  sections: Section[]
  selectedId: number | null
  store: ResultStore
  focused: boolean
  navFocused: boolean
  busyPayment: boolean
  /** Section currently streaming reasoning, if any. */
  liveThinkingSectionId?: number | null
  hasAgent: boolean
  width: number
  scrollRef: RefObject<ScrollBoxRenderable | null>
  /** Section renderables by id, for top-aligned jumps. */
  sectionRegistry: RefObject<Map<number, BoxRenderable>>
  onSelect: (id: number) => void
  onToggleThinking: (id: number) => void
}) {
  const innerWidth = Math.max(24, width - 4)
  const cardWidth = Math.max(30, innerWidth - 2)
  return (
    <box
      flexGrow={1}
      flexDirection="column"
      border
      borderStyle={focused ? 'heavy' : 'single'}
      borderColor={focused ? COLORS.brass : COLORS.border}
      title=" FEED "
      titleColor={focused ? COLORS.brassBright : COLORS.faint}
      backgroundColor={COLORS.background}
    >
      {sections.length === 0 ? (
        <WelcomePanel hasAgent={hasAgent} width={innerWidth} />
      ) : (
        <scrollbox ref={scrollRef} flexGrow={1} paddingX={1} stickyScroll stickyStart="bottom">
          {sections.map((section) => {
            const selected = section.id === selectedId
            return (
              <box
                key={section.id}
                flexDirection="column"
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
                <text
                  marginTop={1}
                  fg={selected ? COLORS.brassBright : COLORS.faint}
                  content={promptKicker(section.prompt, innerWidth, selected)}
                />
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
                        sort={section.sort}
                        maxAssets={20}
                        flow={section.flow}
                      />
                    )
                  }
                  if (block.kind === 'raw') {
                    return (
                      <RawCard key={item.id} title={block.title} text={block.text} width={cardWidth} />
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
            )
          })}
        </scrollbox>
      )}
    </box>
  )
}
