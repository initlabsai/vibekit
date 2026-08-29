/** A panel the viewer can fold — the session nav, the account rail — remembered per browser. */
import { useCallback, useState } from 'react'

/** Below this width a panel is a drawer over the feed, so it starts closed unless the viewer opened it. */
const PHONE = '(max-width: 720px)'

/** `startOpen` is the unsaved desktop default. A phone starts closed. */
export function usePanel(key: string, startOpen = true): [open: boolean, toggle: () => void] {
  const [open, setOpen] = useState(() => {
    try {
      const saved = window.localStorage.getItem(key)
      if (saved === 'closed') return false
      if (saved === 'open') return true
      if (window.matchMedia(PHONE).matches) return false
      return startOpen
    } catch {
      return startOpen
    }
  })
  const toggle = useCallback(() => {
    setOpen((current) => {
      try {
        window.localStorage.setItem(key, current ? 'closed' : 'open')
      } catch {
        // storage may be unavailable; the toggle still works for the session
      }
      return !current
    })
  }, [key])
  return [open, toggle]
}
