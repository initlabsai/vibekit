/** The apps screen's keys and its keybar text. `keys.ts` calls in here when the screen is open. */

/** What the apps screen needs from the keyboard: its state and its actions. */
export interface AppsKeys {
  /** A contract card is open (methods numbered, calls inline). */
  detailOpen: boolean
  /** A method line or the deploy line has the input. */
  methodOpen: boolean
  close: () => void
  /** Opens card n (1-9). */
  activate: (index: number) => void
  /** Picks method n (1-9) of the open card. */
  selectMethod: (index: number) => void
  submit: () => void
  /** o: the open app's record in the feed. */
  open: () => void
  /** d: compose a create of the open spec. */
  deploy: () => void
  cycleAccount: (delta: number) => void
}

/**
 * Handles one key press on the apps screen. Returns false only for the
 * escape that should leave the screen; every other key is this screen's,
 * handled or ignored.
 */
export function handleAppsKey(
  key: { name: string; preventDefault: () => void },
  apps: AppsKeys,
): boolean {
  if (key.name === 'escape') {
    // The detail pane is a layer inside the screen: esc peels it first.
    if (apps.detailOpen) {
      apps.close()
      return true
    }
    return false
  }
  if (apps.methodOpen && (key.name === 'return' || key.name === 'enter')) {
    // The focused args input submits on its own; without this the call
    // fires twice and the two runs race on callBusy/callResult.
    key.preventDefault()
    apps.submit()
    return true
  }
  if (apps.detailOpen && !apps.methodOpen && key.name === 'o') {
    apps.open()
    return true
  }
  if (apps.detailOpen && !apps.methodOpen && key.name === 'd') {
    apps.deploy()
    return true
  }
  const index = Number.parseInt(key.name, 10)
  if (Number.isInteger(index)) {
    if (apps.detailOpen && !apps.methodOpen) apps.selectMethod(index)
    else if (!apps.detailOpen) apps.activate(index)
    return true
  }
  if (!apps.detailOpen && (key.name === '[' || key.name === 'left')) {
    apps.cycleAccount(-1)
    return true
  }
  if (!apps.detailOpen && (key.name === ']' || key.name === 'right')) {
    apps.cycleAccount(1)
    return true
  }
  return true
}

/** The keybar for the apps screen, by how deep the user is in a card. */
export function appsKeybar(state: {
  deployOpen: boolean
  selectedMethod: { readonly?: boolean } | null
  selected: { appId?: number } | null
}): string {
  if (state.deployOpen) return 'enter deploy · esc back'
  if (state.selectedMethod) {
    return state.selectedMethod.readonly
      ? 'enter simulate · esc method'
      : 'enter compose · esc method'
  }
  if (state.selected) {
    return state.selected.appId === undefined
      ? '1-9 method · d deploy · esc back'
      : '1-9 method · o open · d redeploy · esc back'
  }
  return '1-9 open · ←/→ account · esc explore'
}
