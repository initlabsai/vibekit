/**
 * The keyboard, and what each screen shows in its keybar. The one
 * `useKeyboard`; every action is injected from the composition root, and the
 * apps screen's keys live with the apps feature.
 */
import { createTransactionCollectionViewModel, nextPageArgs } from '@initlabs/vibekit/views'
import { findResultRecord, type ResultStore, type ViewSpec } from '@initlabs/vibekit/actions'
import type { LiveNetworkId } from '@initlabs/vibekit/live'
import { useKeyboard } from '@opentui/react'
import { useCallback } from 'react'

import { appsKeybar, handleAppsKey, type AppsKeys } from './features/apps/keys.js'
import type { Feed, Focus, Section } from './feed/hooks.js'
import { transactionsFilterFor, type OpenTarget } from './result-card.js'
import type { Screen } from './top-bar.js'

/** ^1–^5 as the masthead labels them. */
const PAGE_KEYS: Record<string, Exclude<Screen, 'chat' | 'wallet'> | undefined> = {
  '1': 'assets',
  '2': 'apps',
  '3': 'txns',
  '4': 'blocks',
  '5': 'plugins',
}

/** The cards a key can act on: the highlighted one, else every card in the selected section, newest first. */
function cardsInReach(sections: Section[], selectedId: number | null, cursorItemId: number | null) {
  const section = sections.find((candidate) => candidate.id === selectedId)
  const views = (section?.items ?? [])
    .flatMap((item) =>
      item.kind === 'block' && item.block.kind === 'view'
        ? [{ itemId: item.id, view: item.block.view }]
        : [],
    )
    .filter((card) => cursorItemId === null || card.itemId === cursorItemId)
    .reverse()
  return { section, views }
}

/** The single-key actions the cards in reach offer; presence doubles as the keybar's hint. */
export interface CardActions {
  /** A transaction list is in reach: 1-9 opens its rows. */
  rows?: true
  t?: () => void
  e?: () => void
  m?: () => void
  a?: () => void
}

export function cardActionsFor(input: {
  sections: Section[]
  selectedId: number | null
  cursorItemId: number | null
  store: ResultStore
  openTarget: (target: OpenTarget) => void
  loadMore: (sectionId: number, itemId: number, view: ViewSpec) => void
}): CardActions {
  const { section, views } = cardsInReach(input.sections, input.selectedId, input.cursorItemId)
  const actions: CardActions = {}
  for (const { itemId, view } of views) {
    if (!actions.rows && (view.view === 'transaction.list' || view.view === 'transaction.group'))
      actions.rows = true
    if (!actions.t) {
      const filter = transactionsFilterFor(input.store, view)
      if (filter) actions.t = () => input.openTarget({ kind: 'transactions', filter })
    }
    if (!actions.e && view.view === 'application.detail') {
      const filter = transactionsFilterFor(input.store, view)
      if (filter?.applicationId !== undefined) {
        const { applicationId } = filter
        actions.e = () => input.openTarget({ kind: 'program', applicationId })
      }
    }
    if (!actions.m && section && nextPageArgs(findResultRecord(input.store, view.source))) {
      actions.m = () => input.loadMore(section.id, itemId, view)
    }
    if (!actions.a && view.view === 'account.portfolio') {
      const filter = transactionsFilterFor(input.store, view)
      if (filter?.address) {
        const { address } = filter
        actions.a = () => input.openTarget({ kind: 'holdings', address })
      }
    }
  }
  return actions
}

/** Row n (1-9) of the transaction list in reach, as a txid to open. */
export function listRowTxid(input: {
  sections: Section[]
  selectedId: number | null
  cursorItemId: number | null
  store: ResultStore
  index: number
}): string | undefined {
  const { views } = cardsInReach(input.sections, input.selectedId, input.cursorItemId)
  const list = views.find(
    ({ view }) => view.view === 'transaction.list' || view.view === 'transaction.group',
  )
  if (!list) return undefined
  const derived = createTransactionCollectionViewModel(input.store, list.view)
  return derived.ok ? derived.model.transactions[input.index - 1]?.id : undefined
}

/**
 * One grammar everywhere: `key verb`, dots between, no brackets; drawn in
 * the active pane's bottom frame line. Global keys live in the masthead.
 */
export function keybarFor(input: {
  modalOpen: boolean
  screen: Screen
  focus: Focus
  apps: Parameters<typeof appsKeybar>[0]
  tailRunning: boolean
  cardActions: CardActions
  sectionCount: number
}): string {
  const { cardActions } = input
  if (input.modalOpen) return 'enter approve · esc deny'
  switch (input.screen) {
    case 'wallet':
      return '1-9 select · esc explore'
    case 'apps':
      return appsKeybar(input.apps)
    case 'blocks':
      return `space ${input.tailRunning ? 'stop' : 'start'} · esc explore`
    case 'plugins':
      return '1-9 toggle · esc explore'
    case 'assets':
    case 'txns':
      return '←/→ account · esc explore'
    case 'chat':
      if (input.focus === 'content') {
        return [
          '↑/↓ scroll',
          '←/→ cards',
          cardActions.rows ? '1-9 open row' : null,
          cardActions.t ? 't txns' : null,
          cardActions.a ? 'a assets' : null,
          cardActions.e ? 'e explain' : null,
          cardActions.m ? 'm more' : null,
          'x close',
          'tab/esc composer',
        ]
          .filter(Boolean)
          .join(' · ')
      }
      return input.sectionCount > 0
        ? `enter send · tab feed (${input.sectionCount}) · ^s session · ^n network · ctrl+c quit`
        : 'enter send · drag copies · ^n network · ctrl+c quit'
  }
}

/**
 * Global keyboard dispatch: modal decisions first, then workspace shortcuts,
 * then per-screen and per-focus handling.
 */
export function useExplorerKeys({
  feed,
  modalOpen,
  decide,
  switchNetwork,
  openScreen,
  screen,
  setScreen,
  accountList,
  setActiveSender,
  cycleAccount,
  closeSelectedSection,
  apps,
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
  openScreen: (target: Exclude<Screen, 'chat'>) => void
  screen: Screen
  setScreen: (screen: Screen) => void
  accountList: ReadonlyArray<{ address: string; name?: string }>
  setActiveSender: (address: string) => void
  cycleAccount: (delta: number) => void
  closeSelectedSection: () => void
  apps: AppsKeys
  toggleBlocksTail: () => void
  /** Flips plugin row n (1-9) on the plugins screen. */
  togglePlugin: (index: number) => void
  /** Opens row n (1-9) of the transaction list in reach. */
  openListRow: (index: number) => void
  /** t transactions · e explain · m more · a assets, on the card in reach that offers it. */
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
          openScreen('wallet')
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
          openScreen(page)
          return
        }
        if (screen !== 'chat') {
          if (screen === 'apps' && handleAppsKey(key, apps)) return
          if (key.name === 'escape') {
            setScreen('chat')
            setFocus('composer')
            return
          }
          if (screen === 'blocks') {
            if (key.name === 'space') toggleBlocksTail()
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
          const index = Number.parseInt(key.name, 10)
          if (screen === 'wallet' && Number.isInteger(index) && accountList[index - 1]) {
            setActiveSender(accountList[index - 1]!.address)
          }
          if (screen === 'plugins' && Number.isInteger(index)) togglePlugin(index)
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
        apps,
        closeSelectedSection,
        contentScrollRef,
        cycleAccount,
        decide,
        focus,
        modalOpen,
        moveSelection,
        openScreen,
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
