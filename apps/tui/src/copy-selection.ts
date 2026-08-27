import {
  createClipboard,
  createHostClipboard,
  createRendererClipboardAdapter,
  type CliRenderer,
  type ClipboardService,
  type Selection,
} from '@opentui/core'
import { useRenderer, useSelectionHandler } from '@opentui/react'
import { createContext, useCallback, useContext, useEffect, useRef } from 'react'

/** Selected text worth copying; empty drags are ignored. */
export function selectedTextToCopy(
  selection: Pick<Selection, 'getSelectedText'>,
): string | undefined {
  const text = selection.getSelectedText()
  return text.length > 0 ? text : undefined
}

/** Full identifier to put on the clipboard; placeholders are skipped. */
export function copyableIdent(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined
  const text = String(value)
  return text.length > 0 && text !== '—' ? text : undefined
}

function copyText(renderer: CliRenderer, clipboard: ClipboardService | null, text: string): void {
  if (clipboard) {
    void clipboard.writeText(text, { destination: 'all-available' })
    return
  }
  renderer.copyToClipboardOSC52(text)
}

export const CopyContext = createContext<(text: string) => void>(() => {})

/** Copies the full identifier, even when the card shows a truncated form. */
export function useCopyIdent(): (text: string) => void {
  return useContext(CopyContext)
}

/**
 * Drag-select copies immediately, then drops the highlight so the next
 * drag starts clean. Uses the host clipboard and OSC 52 together.
 */
export function useCopyOnSelect(onCopied?: (text: string) => void): (text: string) => void {
  const renderer = useRenderer()
  const clipboardRef = useRef<ClipboardService | null>(null)
  const onCopiedRef = useRef(onCopied)
  onCopiedRef.current = onCopied

  useEffect(() => {
    try {
      const host = createHostClipboard()
      const clipboard = createClipboard({
        host,
        terminal: createRendererClipboardAdapter(renderer),
      })
      clipboardRef.current = clipboard
      return () => {
        clipboardRef.current = null
        void clipboard.dispose()
      }
    } catch {
      clipboardRef.current = null
      return undefined
    }
  }, [renderer])

  const copy = useCallback(
    (text: string) => {
      if (!text) return
      copyText(renderer, clipboardRef.current, text)
      onCopiedRef.current?.(text)
    },
    [renderer],
  )

  useSelectionHandler((selection) => {
    const text = selectedTextToCopy(selection)
    if (!text) return
    copy(text)
    renderer.clearSelection()
  })

  return copy
}
