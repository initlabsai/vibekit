/** The transcript's state: sections, their items (notes and cards), cursor, focus, and scrolling. */
import type { BoxRenderable, ScrollBoxRenderable } from '@opentui/core'
import { useCallback, useRef, useState } from 'react'

import type { ViewSpec, ActionState } from '@initlabs/vibekit/actions'

/** One rendered result inside a section — a request may compose several. */
export type SectionBlock =
  | { kind: 'view'; view: ViewSpec }
  | { kind: 'raw'; title: string; text: string }
  /** A plugin-declared trusted view; `data` already parsed against the plugin's schema. */
  /** A coarse `table` view's result, pre-shaped by tableModel — formatted raw, not trusted. */
  | {
      kind: 'table'
      title: string
      facts: Array<[string, string]>
      rows: Array<Record<string, unknown>>
    }
  | { kind: 'action'; flow: ActionState }

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

/** Which pane owns the keyboard on the chat screen. */
export type Focus = 'composer' | 'content'

/**
 * Owns the results feed: one section per user request, plus the selection,
 * focus, scrolling, and render-registry state that navigates it.
 */
export function useFeed() {
  const [sections, setSections] = useState<Section[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [focus, setFocusState] = useState<Focus>('composer')

  const sectionSeq = useRef(0)
  const itemSeq = useRef(0)
  const sectionsRef = useRef<Section[]>(sections)
  const selectedRef = useRef<number | null>(selectedId)
  const contentScrollRef = useRef<ScrollBoxRenderable | null>(null)
  const sectionRegistry = useRef(new Map<number, BoxRenderable>())
  /** The highlighted card (a block item id); ←/→ and clicks move it, keys act on it. */
  const [cursorItemId, setCursorItemId] = useState<number | null>(null)
  const cursorRef = useRef<number | null>(null)
  const cardRegistry = useRef(new Map<number, BoxRenderable>())
  sectionsRef.current = sections
  selectedRef.current = selectedId
  cursorRef.current = cursorItemId

  const commitSections = useCallback((next: Section[]) => {
    sectionsRef.current = next
    setSections(next)
  }, [])

  const newItemId = useCallback(() => {
    itemSeq.current += 1
    return itemSeq.current
  }, [])

  /** Jumps a feed group into view (nav click, enter, ←/→). New groups rely on sticky-bottom instead. */
  const scrollToSection = useCallback((id: number) => {
    const attempt = () => {
      const target = sectionRegistry.current.get(id)
      const scroll = contentScrollRef.current
      if (!target || !scroll) return false
      const offset = scroll.scrollTop + (target.y - scroll.viewport.y)
      scroll.scrollTo({ x: 0, y: Math.max(0, offset) })
      return true
    }
    if (!attempt()) setTimeout(attempt, 50)
  }, [])

  /** Scrolls one card's top into view, like scrollToSection but for a block item. */
  const scrollToCard = useCallback((itemId: number) => {
    const attempt = () => {
      const target = cardRegistry.current.get(itemId)
      const scroll = contentScrollRef.current
      if (!target || !scroll) return false
      const offset = scroll.scrollTop + (target.y - scroll.viewport.y)
      scroll.scrollTo({ x: 0, y: Math.max(0, offset - 1) })
      return true
    }
    if (!attempt()) setTimeout(attempt, 50)
  }, [])

  /** Highlights one card and its section without moving the viewport (a click). */
  const setCursor = useCallback((sectionId: number, itemId: number | null) => {
    setSelectedId(sectionId)
    selectedRef.current = sectionId
    setCursorItemId(itemId)
    cursorRef.current = itemId
  }, [])

  /** Handing the keyboard back to the composer drops the card highlight; the selection stays. */
  const setFocus = useCallback((next: Focus) => {
    if (next === 'composer') {
      setCursorItemId(null)
      cursorRef.current = null
    }
    setFocusState(next)
  }, [])

  /** Pins the viewport to the newest content once layout has caught up with the commit. */
  const scrollToBottom = useCallback(() => {
    const go = () => {
      const scroll = contentScrollRef.current
      if (scroll) scroll.scrollTo({ x: 0, y: scroll.scrollHeight })
    }
    setTimeout(go, 0)
    setTimeout(go, 50)
  }, [])

  /** scrollToSection once layout has caught up with the commit (mirrors scrollToBottom). */
  const scrollToSectionSoon = useCallback(
    (id: number) => {
      setTimeout(() => scrollToSection(id), 0)
      setTimeout(() => scrollToSection(id), 50)
    },
    [scrollToSection],
  )

  /** Highlights a feed group without moving the viewport. Used on content clicks so a drag-select does not jump. */
  const markSection = useCallback((id: number) => {
    setSelectedId(id)
    selectedRef.current = id
  }, [])

  /** Nav jump: the section's first card takes the cursor and the section scrolls into view. */
  const selectSection = useCallback(
    (id: number) => {
      const first = sectionsRef.current
        .find((section) => section.id === id)
        ?.items.find((item) => item.kind === 'block')
      setCursor(id, first?.id ?? null)
      scrollToSection(id)
    },
    [scrollToSection, setCursor],
  )

  /** Creates the section for one user request and returns its id. */
  const createSection = useCallback(
    (prompt: string): number => {
      sectionSeq.current += 1
      const id = sectionSeq.current
      commitSections([...sectionsRef.current, { id, prompt, items: [] }])
      // A new request takes the selection; the highlight leaves the old card.
      setCursor(id, null)
      scrollToBottom()
      return id
    },
    [commitSections, scrollToBottom, setCursor],
  )

  /** Rewrites one section; the others keep their identity. */
  const updateSection = useCallback(
    (sectionId: number, update: (section: Section) => Section) => {
      commitSections(
        sectionsRef.current.map((section) =>
          section.id === sectionId ? update(section) : section,
        ),
      )
    },
    [commitSections],
  )

  /** Rewrites one item inside a section. */
  const updateItem = useCallback(
    (sectionId: number, itemId: number, update: (item: SectionItem) => SectionItem) => {
      updateSection(sectionId, (section) => ({
        ...section,
        items: section.items.map((item) => (item.id === itemId ? update(item) : item)),
      }))
    },
    [updateSection],
  )

  const appendItem = useCallback(
    (sectionId: number, item: SectionItem) => {
      const hadCard = sectionsRef.current
        .find((section) => section.id === sectionId)
        ?.items.some((entry) => entry.kind === 'block')
      updateSection(sectionId, (section) => ({ ...section, items: [...section.items, item] }))
      // A card lands with its header in view — a tall one would otherwise show
      // only its tail. Notes stick to the bottom until a card is on screen.
      if (item.kind === 'block') scrollToSectionSoon(sectionId)
      else if (!hadCard) scrollToBottom()
    },
    [scrollToBottom, scrollToSectionSoon, updateSection],
  )

  /** Swaps one rendered block's view (a merged page replaces its first page). */
  const replaceBlockView = useCallback(
    (sectionId: number, itemId: number, view: ViewSpec) => {
      updateItem(sectionId, itemId, (item) =>
        item.kind === 'block' && item.block.kind === 'view'
          ? { ...item, block: { ...item.block, view } }
          : item,
      )
    },
    [updateItem],
  )

  const patchSection = useCallback(
    (sectionId: number, patch: Partial<Section>) => {
      updateSection(sectionId, (section) => ({ ...section, ...patch }))
    },
    [updateSection],
  )

  const toggleThinking = useCallback(
    (sectionId: number) => {
      updateSection(sectionId, (section) => ({ ...section, thinkingOpen: !section.thinkingOpen }))
    },
    [updateSection],
  )

  const appendNote = useCallback(
    (sectionId: number, text: string, tone: 'muted' | 'error' | 'agent' = 'muted') => {
      appendItem(sectionId, { id: newItemId(), kind: 'note', text, tone })
    },
    [appendItem, newItemId],
  )

  const appendBlock = useCallback(
    (sectionId: number, block: SectionBlock): number => {
      const id = newItemId()
      appendItem(sectionId, { id, kind: 'block', block })
      return id
    },
    [appendItem, newItemId],
  )

  /** ←/→: the cursor walks every card in the feed in order; with no cursor yet it starts at the newest. */
  const moveSelection = useCallback(
    (delta: number) => {
      const cards = sectionsRef.current.flatMap((section) =>
        section.items.flatMap((item) =>
          item.kind === 'block' ? [{ sectionId: section.id, itemId: item.id }] : [],
        ),
      )
      if (cards.length === 0) return
      const current = cards.findIndex((card) => card.itemId === cursorRef.current)
      const index =
        current < 0 ? cards.length - 1 : Math.min(cards.length - 1, Math.max(0, current + delta))
      const card = cards[index]!
      setCursor(card.sectionId, card.itemId)
      scrollToCard(card.itemId)
    },
    [scrollToCard, setCursor],
  )

  /** Closes the selected section unless `canClose` vetoes it (then `onBlocked` runs instead). */
  const closeSelectedSection = useCallback(
    (canClose: (sectionId: number) => boolean, onBlocked: () => void) => {
      const list = sectionsRef.current
      const index = list.findIndex((section) => section.id === selectedRef.current)
      if (index < 0) return
      if (!canClose(list[index]!.id)) {
        onBlocked()
        return
      }
      const next = list.filter((section) => section.id !== selectedRef.current)
      commitSections(next)
      if (next.length === 0) {
        setSelectedId(null)
        selectedRef.current = null
        setCursorItemId(null)
        cursorRef.current = null
        setFocus('composer')
      } else {
        selectSection(next[Math.min(index, next.length - 1)]!.id)
      }
    },
    [commitSections, selectSection],
  )

  return {
    sections,
    selectedId,
    focus,
    setFocus,
    sectionsRef,
    contentScrollRef,
    sectionRegistry,
    cursorItemId,
    cardRegistry,
    setCursor,
    updateItem,
    newItemId,
    markSection,
    selectSection,
    createSection,
    appendItem,
    replaceBlockView,
    patchSection,
    toggleThinking,
    appendNote,
    appendBlock,
    moveSelection,
    closeSelectedSection,
  }
}

export type Feed = ReturnType<typeof useFeed>
