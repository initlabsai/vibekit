import {
  createAccountPortfolioViewModel,
  createPaymentFlowViewModel,
  createTransactionDetailViewModel,
  type ResultStore,
  type ViewSpec,
  type WriteFlowState,
} from '@initlabs/vibekit-experience'
import type { BoxRenderable, ScrollBoxRenderable } from '@opentui/core'
import type { RefObject } from 'react'

import { AccountCard, PaymentCard, TransactionCard, type AssetSort } from './cards.js'
import { COLORS, shorten, wrapLines } from './theme.js'

/** One rendered result inside a section — a request may compose several. */
export type SectionBlock =
  | { id: number; kind: 'transaction'; view: ViewSpec }
  | { id: number; kind: 'account'; view: ViewSpec }
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
}

function divider(prompt: string, width: number): string {
  const label = ` › ${prompt} `
  const room = Math.max(8, width)
  const shortened = shorten(label, room - 6)
  return `──${shortened}${'─'.repeat(Math.max(2, room - shortened.length - 2))}`
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
      borderStyle="single"
      borderColor={focused ? COLORS.brass : COLORS.border}
      backgroundColor={COLORS.background}
    >
      <box height={1} paddingX={1}>
        <text fg={focused ? COLORS.brassBright : COLORS.muted}>SESSION</text>
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
 * The reading pane: every section in order — prompt divider, narration,
 * cards. New sections scroll to the top of the viewport; the nav jumps here.
 */
export function ContentPane({
  sections,
  selectedId,
  store,
  focused,
  navFocused,
  busyPayment,
  thinking,
  thinkingSectionId,
  emptyText,
  width,
  scrollRef,
  sectionRegistry,
  onSelect,
}: {
  sections: Section[]
  selectedId: number | null
  store: ResultStore
  focused: boolean
  navFocused: boolean
  busyPayment: boolean
  /** A live reasoning stream shown in its section until a card renders. */
  thinking?: string
  thinkingSectionId?: number | null
  emptyText: string
  width: number
  scrollRef: RefObject<ScrollBoxRenderable | null>
  /** Section renderables by id, for top-aligned jumps. */
  sectionRegistry: RefObject<Map<number, BoxRenderable>>
  onSelect: (id: number) => void
}) {
  const innerWidth = Math.max(24, width - 4)
  const cardWidth = Math.max(30, innerWidth - 2)
  return (
    <box
      flexGrow={1}
      flexDirection="column"
      border
      borderStyle="single"
      borderColor={focused ? COLORS.brass : COLORS.border}
      backgroundColor={COLORS.background}
    >
      {sections.length === 0 ? (
        <box flexGrow={1} padding={1}>
          <text fg={COLORS.muted} content={wrapLines(emptyText, innerWidth).join('\n')} />
        </box>
      ) : (
        <scrollbox ref={scrollRef} flexGrow={1} paddingX={1}>
          {sections.map((section) => {
            const selected = section.id === selectedId
            return (
              <box
                key={section.id}
                flexDirection="column"
                onMouseDown={() => onSelect(section.id)}
                ref={(renderable: BoxRenderable | null) => {
                  if (renderable) sectionRegistry.current.set(section.id, renderable)
                  else sectionRegistry.current.delete(section.id)
                }}
              >
                <text
                  marginTop={1}
                  fg={selected && (focused || navFocused) ? COLORS.brassBright : COLORS.muted}
                  content={divider(section.prompt, innerWidth)}
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
                  if (block.kind === 'transaction') {
                    const derived = createTransactionDetailViewModel(store, block.view)
                    return (
                      <TransactionCard
                        key={item.id}
                        model={derived.ok ? derived.model : undefined}
                        width={cardWidth}
                      />
                    )
                  }
                  if (block.kind === 'account') {
                    const derived = createAccountPortfolioViewModel(store, block.view)
                    return (
                      <AccountCard
                        key={item.id}
                        model={derived.ok ? derived.model : undefined}
                        width={cardWidth}
                        sort={section.sort}
                        maxAssets={20}
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
                {thinking && thinkingSectionId === section.id ? (
                  <text
                    marginTop={1}
                    fg={COLORS.muted}
                    content={wrapLines(`thinking… ${thinking}`, innerWidth).join('\n')}
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
