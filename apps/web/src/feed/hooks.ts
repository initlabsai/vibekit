/** The transcript's state: sections, their items (notes and cards), and the selection. */
import { useCallback, useRef, useState } from 'react'

import type { ViewSpec, WriteFlowState } from '@initlabs/vibekit-explorer'

/** One rendered result inside a section — a request may compose several. */
export type SectionBlock =
  | { kind: 'view'; view: ViewSpec }
  | { kind: 'raw'; title: string; text: string }
  /** A plugin-declared trusted view; `data` already parsed against the plugin's schema. */
  | { kind: 'plugin'; view: string; data: unknown; network: string }
  | { kind: 'write'; flow: WriteFlowState }

/** One entry in a section's body, in arrival order. */
export type SectionItem =
  | { id: number; kind: 'note'; text: string; tone: 'muted' | 'error' | 'agent'; /** Still being written: 'thinking…', '→ tool…'. */ pending?: boolean }
  | { id: number; kind: 'block'; block: SectionBlock }

/** Everything one request produced, in order. The nav pane is this list's index. */
export interface Section {
  id: number
  prompt: string
  items: SectionItem[]
  /** Folded by its bar; the nav still lists it. */
  collapsed?: boolean
}

export function useFeed() {
  const [sections, setSections] = useState<Section[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const sectionSeq = useRef(0)
  const itemSeq = useRef(0)
  const sectionsRef = useRef<Section[]>(sections)
  sectionsRef.current = sections

  const commitSections = useCallback((next: Section[]) => {
    sectionsRef.current = next
    setSections(next)
  }, [])

  /** Brings a section's header into view once React has committed it. */
  const scrollToSection = useCallback((id: number) => {
    setTimeout(() => {
      document
        .querySelector(`[data-section="${id}"]`)
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }, 0)
  }, [])

  /** Pins the feed to its newest content once React has committed it (new request, new card). */
  const scrollToBottom = useCallback(() => {
    const go = () => {
      const feed = document.querySelector<HTMLElement>('.feed')
      if (feed) feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' })
    }
    setTimeout(go, 0)
    setTimeout(go, 80)
  }, [])

  const selectSection = useCallback(
    (id: number) => {
      setSelectedId(id)
      scrollToSection(id)
    },
    [scrollToSection],
  )

  const createSection = useCallback(
    (prompt: string): number => {
      sectionSeq.current += 1
      const id = sectionSeq.current
      commitSections([...sectionsRef.current, { id, prompt, items: [] }])
      setSelectedId(id)
      scrollToBottom()
      return id
    },
    [commitSections, scrollToBottom],
  )

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
      // New content lands at the bottom; the nav is the way back up.
      scrollToBottom()
    },
    [scrollToBottom, updateSection],
  )

  const appendNoteReturning = useCallback(
    (sectionId: number, text: string, tone: 'muted' | 'error' | 'agent' = 'muted'): number => {
      itemSeq.current += 1
      appendItem(sectionId, { id: itemSeq.current, kind: 'note', text, tone })
      return itemSeq.current
    },
    [appendItem],
  )

  const appendNote = useCallback(
    (sectionId: number, text: string, tone: 'muted' | 'error' | 'agent' = 'muted') => {
      appendNoteReturning(sectionId, text, tone)
    },
    [appendNoteReturning],
  )

  const appendBlock = useCallback(
    (sectionId: number, block: SectionBlock): number => {
      itemSeq.current += 1
      const id = itemSeq.current
      appendItem(sectionId, { id, kind: 'block', block })
      return id
    },
    [appendItem],
  )

  const toggleCollapsed = useCallback(
    (sectionId: number) => {
      updateSection(sectionId, (section) => ({ ...section, collapsed: !section.collapsed }))
    },
    [updateSection],
  )

  const removeItem = useCallback(
    (sectionId: number, itemId: number) => {
      updateSection(sectionId, (section) => ({ ...section, items: section.items.filter((item) => item.id !== itemId) }))
    },
    [updateSection],
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

  return {
    sections,
    sectionsRef,
    selectedId,
    selectSection,
    createSection,
    updateItem,
    removeItem,
    appendNote,
    appendNoteReturning,
    appendBlock,
    replaceBlockView,
    toggleCollapsed,
  }
}

export type Feed = ReturnType<typeof useFeed>
