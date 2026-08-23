import type { BoxRenderable, ScrollBoxRenderable } from '@opentui/core'
import { useCallback, useRef, useState } from 'react'

import type { ViewSpec } from '@initlabs/vibekit-explorer'
import type { Section, SectionBlock, SectionItem } from '../sections.js'

/** Which pane owns the keyboard on the chat screen. */
export type Focus = 'composer' | 'content'

/**
 * Owns the results feed: one section per user request, plus the selection,
 * focus, scrolling, and render-registry state that navigates it.
 */
export function useFeed() {
  const [sections, setSections] = useState<Section[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [focus, setFocus] = useState<Focus>('composer')

  const sectionSeq = useRef(0)
  const itemSeq = useRef(0)
  const sectionsRef = useRef<Section[]>(sections)
  const selectedRef = useRef<number | null>(selectedId)
  const contentScrollRef = useRef<ScrollBoxRenderable | null>(null)
  const sectionRegistry = useRef(new Map<number, BoxRenderable>())
  sectionsRef.current = sections
  selectedRef.current = selectedId

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

  /** Pins the viewport to the newest content once layout has caught up with the commit. */
  const scrollToBottom = useCallback(() => {
    const go = () => {
      const scroll = contentScrollRef.current
      if (scroll) scroll.scrollTo({ x: 0, y: scroll.scrollHeight })
    }
    setTimeout(go, 0)
    setTimeout(go, 50)
  }, [])

  /** Highlights a feed group without moving the viewport. Used on content clicks so a drag-select does not jump. */
  const markSection = useCallback((id: number) => {
    setSelectedId(id)
    selectedRef.current = id
  }, [])

  const selectSection = useCallback(
    (id: number) => {
      markSection(id)
      scrollToSection(id)
    },
    [markSection, scrollToSection],
  )

  /** Creates the section for one user request and returns its id. */
  const createSection = useCallback(
    (prompt: string): number => {
      sectionSeq.current += 1
      const id = sectionSeq.current
      commitSections([...sectionsRef.current, { id, prompt, items: [] }])
      setSelectedId(id)
      selectedRef.current = id
      scrollToBottom()
      return id
    },
    [commitSections, scrollToBottom],
  )

  /** Rewrites one section; the others keep their identity. */
  const updateSection = useCallback(
    (sectionId: number, update: (section: Section) => Section) => {
      commitSections(
        sectionsRef.current.map((section) => (section.id === sectionId ? update(section) : section)),
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
      updateSection(sectionId, (section) => ({ ...section, items: [...section.items, item] }))
      // A new card or note always comes from the user's own request: show it.
      scrollToBottom()
    },
    [scrollToBottom, updateSection],
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

  const moveSelection = useCallback(
    (delta: number) => {
      const list = sectionsRef.current
      if (list.length === 0) return
      const current = list.findIndex((section) => section.id === selectedRef.current)
      const index =
        current < 0 ? list.length - 1 : Math.min(list.length - 1, Math.max(0, current + delta))
      selectSection(list[index]!.id)
    },
    [selectSection],
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
    selectedRef,
    contentScrollRef,
    scrollToBottom,
    sectionRegistry,
    updateSection,
    updateItem,
    newItemId,
    scrollToSection,
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
