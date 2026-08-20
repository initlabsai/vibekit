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
  items: SectionItem[]
  /** Model reasoning for this request; folded by default. */
  thinking?: string
  thinkingOpen?: boolean
}

function promptKicker(prompt: string, width: number): string {
  return shorten(`› ${prompt}`, Math.max(8, width))
}

function promptRule(width: number): string {
  return '─'.repeat(Math.max(4, width))
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

/** Quiet empty-feed invite. Commands also live in the composer hint. */
export function WelcomePanel({ hasAgent }: { hasAgent: boolean }) {
  return (
    <box flexGrow={1} padding={2} flexDirection="column">
      <text fg={COLORS.faint}>VIBEKIT</text>
      <text fg={COLORS.brassBright}>explorer</text>
      <text fg={COLORS.muted} marginTop={2} content="Ask about Algorand." />
      <text fg={COLORS.text} marginTop={2} content="  pay 0.5" />
      <text fg={COLORS.text} content="  list my accounts" />
      <text fg={COLORS.text} content="  sample" />
      <text
        fg={COLORS.faint}
        marginTop={2}
        content={hasAgent ? 'or paste an id' : 'set VIBEKIT_AGENT_MODEL to chat'}
      />
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
      borderStyle="rounded"
      borderColor={focused ? COLORS.brass : COLORS.border}
      backgroundColor={COLORS.background}
    >
      <box height={1} paddingX={1}>
        <text fg={focused ? COLORS.brassBright : COLORS.faint}>SESSION</text>
      </box>
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
      borderStyle="rounded"
      borderColor={focused ? COLORS.brass : COLORS.border}
      backgroundColor={COLORS.background}
    >
      {sections.length === 0 ? (
        <WelcomePanel hasAgent={hasAgent} />
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
                  fg={selected && (focused || navFocused) ? COLORS.brassBright : COLORS.faint}
                  content={promptKicker(section.prompt, innerWidth)}
                />
                <text
                  fg={COLORS.borderSoft}
                  content={promptRule(innerWidth)}
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
