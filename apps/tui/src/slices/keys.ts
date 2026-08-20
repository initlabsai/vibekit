import type { LiveNetworkId } from '@initlabs/vibekit-experience/live'
import { useKeyboard } from '@opentui/react'
import { useCallback } from 'react'

import type { WorkspaceScreen } from '../chrome.js'
import type { Feed } from './feed.js'

/**
 * Global keyboard dispatch: modal decisions first, then workspace shortcuts,
 * then per-screen and per-focus handling. Pure wiring — every action is
 * injected from the composition root.
 */
export function useExplorerKeys({
  feed,
  modalOpen,
  decide,
  switchNetwork,
  openWorkspace,
  screen,
  setScreen,
  accountList,
  setActiveSender,
  cycleAccount,
  cycleSort,
  closeSelectedSection,
  isNarrow,
}: {
  feed: Feed
  modalOpen: boolean
  decide: (decision: 'approve' | 'deny') => void
  switchNetwork: (target?: LiveNetworkId, sectionId?: number) => void
  openWorkspace: (target: Exclude<WorkspaceScreen, 'chat'>) => void
  screen: WorkspaceScreen
  setScreen: (screen: WorkspaceScreen) => void
  accountList: ReadonlyArray<{ address: string; name?: string }>
  setActiveSender: (address: string) => void
  cycleAccount: (delta: number) => void
  cycleSort: () => void
  closeSelectedSection: () => void
  isNarrow: boolean
}) {
  const {
    focus,
    setFocus,
    moveSelection,
    scrollToSection,
    selectedRef,
    contentScrollRef,
    sectionsRef,
  } = feed

  useKeyboard(
    useCallback(
      (key) => {
        if (key.eventType === 'release') return
        if (modalOpen) {
          if (key.name === 'return' || key.name === 'enter') decide('approve')
          if (key.name === 'escape') decide('deny')
          return
        }
        if (key.ctrl && key.name === 'n') {
          switchNetwork()
          return
        }
        if (key.ctrl && key.name === 'w') {
          openWorkspace('wallet')
          return
        }
        if (key.ctrl && key.name === '1') {
          openWorkspace('assets')
          return
        }
        if (key.ctrl && key.name === '2') {
          openWorkspace('apps')
          return
        }
        if (key.ctrl && key.name === '3') {
          openWorkspace('txns')
          return
        }
        if (screen !== 'chat') {
          if (key.name === 'escape') {
            setScreen('chat')
            setFocus('composer')
            return
          }
          if (key.name === '[' || key.name === 'left') {
            cycleAccount(-1)
            return
          }
          if (key.name === ']' || key.name === 'right') {
            cycleAccount(1)
            return
          }
          if (screen === 'wallet') {
            const index = Number.parseInt(key.name, 10)
            if (Number.isInteger(index) && accountList[index - 1]) {
              setActiveSender(accountList[index - 1]!.address)
            }
          }
          return
        }
        if (focus === 'nav') {
          switch (key.name) {
            case 'escape':
            case 'c':
              setFocus('composer')
              return
            case 'tab':
              setFocus('content')
              return
            case 'up':
            case 'k':
              moveSelection(-1)
              return
            case 'down':
            case 'j':
              moveSelection(1)
              return
            case 'return':
            case 'enter':
              if (selectedRef.current !== null) scrollToSection(selectedRef.current)
              return
            case 's':
              cycleSort()
              return
            case 'x':
              closeSelectedSection()
              return
            default:
              return
          }
        }
        if (focus === 'content') {
          switch (key.name) {
            case 'tab':
            case 'escape':
            case 'c':
              setFocus('composer')
              return
            case 'up':
            case 'k':
              contentScrollRef.current?.scrollBy(-2)
              return
            case 'down':
            case 'j':
              contentScrollRef.current?.scrollBy(2)
              return
            case 'pageup':
              contentScrollRef.current?.scrollBy(-10)
              return
            case 'pagedown':
              contentScrollRef.current?.scrollBy(10)
              return
            case 'left':
            case '[':
              moveSelection(-1)
              return
            case 'right':
            case ']':
              moveSelection(1)
              return
            case 's':
              cycleSort()
              return
            case 'x':
              closeSelectedSection()
              return
            default:
              return
          }
        }
        if (key.name === 'tab' && sectionsRef.current.length > 0) {
          setFocus(isNarrow ? 'content' : 'nav')
        }
      },
      [
        accountList,
        closeSelectedSection,
        contentScrollRef,
        cycleAccount,
        cycleSort,
        decide,
        focus,
        isNarrow,
        modalOpen,
        moveSelection,
        openWorkspace,
        screen,
        scrollToSection,
        sectionsRef,
        selectedRef,
        setActiveSender,
        setFocus,
        setScreen,
        switchNetwork,
      ],
    ),
  )
}
