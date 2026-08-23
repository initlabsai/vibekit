import type { LiveNetworkId } from '@initlabs/vibekit-explorer/live'
import { useKeyboard } from '@opentui/react'
import { useCallback } from 'react'

import type { WorkspaceScreen } from '../chrome.js'
import type { Feed } from './feed.js'

/** ^1–^4 as the masthead labels them. */
const PAGE_KEYS: Record<string, Exclude<WorkspaceScreen, 'chat' | 'wallet'> | undefined> = {
  '1': 'assets',
  '2': 'apps',
  '3': 'txns',
  '4': 'blocks',
  '5': 'plugins',
}

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
  closeSelectedSection,
  appsDetailOpen,
  closeAppsDetail,
  activateAppsEntry,
  appsMethodOpen,
  selectAppsMethod,
  submitAppsCall,
  toggleBlocksTail,
  togglePlugin,
  openListRow,
  runCardAction,
  toggleNav,
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
  closeSelectedSection: () => void
  appsDetailOpen: boolean
  closeAppsDetail: () => void
  activateAppsEntry: (index: number) => void
  appsMethodOpen: boolean
  selectAppsMethod: (index: number) => void
  submitAppsCall: () => void
  toggleBlocksTail: () => void
  /** Flips plugin row n (1-9) on the plugins screen. */
  togglePlugin: (index: number) => void
  /** Opens row n (1-9) of the newest transaction list in the selected section. */
  openListRow: (index: number) => void
  /** t transactions · e explain · m more, on the newest card in the selected section that offers it. */
  runCardAction: (key: 't' | 'e' | 'm' | 'a') => void
  /** ^s shows or hides the session index. */
  toggleNav: () => void
}) {
  const { focus, setFocus, moveSelection, contentScrollRef, sectionsRef } = feed

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
          key.preventDefault()
          switchNetwork()
          return
        }
        if (key.ctrl && key.name === 'w') {
          key.preventDefault()
          openWorkspace('wallet')
          return
        }
        if (key.ctrl && key.name === 's') {
          key.preventDefault()
          toggleNav()
          return
        }
        // Ctrl+digit is dropped by most terminals (including tmux); Alt/option
        // still arrives as meta/option plus the digit, which is what ^1/^2/^3
        // have to mean outside Kitty's keyboard protocol.
        const page = key.ctrl || key.meta || key.option ? PAGE_KEYS[key.name] : undefined
        if (page) {
          key.preventDefault()
          openWorkspace(page)
          return
        }
        if (screen !== 'chat') {
          if (key.name === 'escape') {
            // The apps detail pane is a layer inside the screen: esc peels it first.
            if (screen === 'apps' && appsDetailOpen) {
              closeAppsDetail()
              return
            }
            setScreen('chat')
            setFocus('composer')
            return
          }
          if (screen === 'apps') {
            if (appsMethodOpen && (key.name === 'return' || key.name === 'enter')) {
              // The focused args input submits on its own; without this the
              // call fires twice and the two runs race on callBusy/callResult.
              key.preventDefault()
              submitAppsCall()
              return
            }
            const index = Number.parseInt(key.name, 10)
            if (Number.isInteger(index)) {
              if (appsDetailOpen && !appsMethodOpen) selectAppsMethod(index)
              else if (!appsDetailOpen) activateAppsEntry(index)
              return
            }
            if (!appsDetailOpen && (key.name === '[' || key.name === 'left')) {
              cycleAccount(-1)
              return
            }
            if (!appsDetailOpen && (key.name === ']' || key.name === 'right')) {
              cycleAccount(1)
              return
            }
            return
          }
          if (screen === 'blocks') {
            if (key.name === 'space') {
              toggleBlocksTail()
              return
            }
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
          if (screen === 'plugins') {
            const index = Number.parseInt(key.name, 10)
            if (Number.isInteger(index)) togglePlugin(index)
          }
          return
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
            case 'x':
              closeSelectedSection()
              return
            case 't':
            case 'e':
            case 'm':
            case 'a':
              runCardAction(key.name)
              return
            default: {
              const index = Number.parseInt(key.name, 10)
              if (Number.isInteger(index) && index >= 1 && index <= 9) openListRow(index)
              return
            }
          }
        }
        if (key.name === 'tab' && sectionsRef.current.length > 0) setFocus('content')
      },
      [
        accountList,
        activateAppsEntry,
        appsDetailOpen,
        appsMethodOpen,
        closeAppsDetail,
        selectAppsMethod,
        submitAppsCall,
        closeSelectedSection,
        contentScrollRef,
        cycleAccount,
        decide,
        focus,
        modalOpen,
        moveSelection,
        openWorkspace,
        screen,
        sectionsRef,
        setActiveSender,
        setFocus,
        setScreen,
        switchNetwork,
        toggleBlocksTail,
        togglePlugin,
        openListRow,
        runCardAction,
        toggleNav,
      ],
    ),
  )
}
