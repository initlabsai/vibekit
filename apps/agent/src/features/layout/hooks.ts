/** A panel the viewer can fold — the session nav, the account rail — remembered per browser. */
import { useCallback, useState } from 'react'

export function usePanel(key: string): [open: boolean, toggle: () => void] {
  const [open, setOpen] = useState(() => {
    try {
      return window.localStorage.getItem(key) !== 'closed'
    } catch {
      return true
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
