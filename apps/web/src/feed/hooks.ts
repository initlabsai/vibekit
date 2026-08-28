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
  | { id: number; kind: 'note'; text: string; tone: 'muted' | 'error' }
  | { id: number; kind: 'block'; block: SectionBlock }

/** Everything one request produced, in order. The nav pane is this list's index. */
export interface Section {
  id: number
  prompt: string
  items: SectionItem[]
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
      scrollToSection(id)
      return id
    },
    [commitSections, scrollToSection],
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
      if (item.kind === 'block') scrollToSection(sectionId)
    },
    [scrollToSection, updateSection],
  )

  const appendNote = useCallback(
    (sectionId: number, text: string, tone: 'muted' | 'error' = 'muted') => {
      itemSeq.current += 1
      appendItem(sectionId, { id: itemSeq.current, kind: 'note', text, tone })
    },
    [appendItem],
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
    appendNote,
    appendBlock,
    replaceBlockView,
  }
}

export type Feed = ReturnType<typeof useFeed>
