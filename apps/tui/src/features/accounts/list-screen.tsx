import type { ResultStore, ViewSpec } from '@initlabs/vibekit-explorer'

import { Ident } from '../../primitives.js'
import { ResultCard, type OpenTarget } from '../../result-card.js'
import { COLORS, shorten } from '../../theme.js'

/** The active account's assets or transactions as one list card. */
export function AccountListScreen({
  title,
  accountName,
  address,
  loading,
  error,
  empty,
  store,
  view,
  width,
  onOpen,
  onMore,
  loadingMore,
  keys,
}: {
  /** Key hints for this screen, drawn in the bottom frame line. */
  keys: string
  title: string
  accountName?: string
  address?: string
  loading: boolean
  error?: string
  empty: string
  store: ResultStore
  view?: ViewSpec
  width: number
  onOpen: (target: OpenTarget) => void
  onMore: () => void
  loadingMore: boolean
}) {
  const inner = Math.max(24, width - 6)
  const owner = address ? (accountName ?? shorten(address, 16)) : 'no wallet'
  return (
    <box
      flexGrow={1}
      flexDirection="column"
      padding={1}
      border
      borderStyle="heavy"
      borderColor={COLORS.brass}
      title={` ${title} · ${owner} `}
      titleColor={COLORS.brassBright}
      bottomTitle={` ${shorten(keys, Math.max(8, width - 6))} `}
      bottomTitleAlignment="right"
      backgroundColor={COLORS.background}
    >
      {address ? <Ident value={address} width={inner} /> : null}
      {loading ? (
        <text fg={COLORS.muted} marginTop={1} content="Looking up…" />
      ) : error ? (
        <text fg={COLORS.brassBright} marginTop={1} content={error} />
      ) : !address ? (
        <text fg={COLORS.muted} marginTop={1} content="Pick a wallet with ^w, then come back." />
      ) : view ? (
        <scrollbox flexGrow={1} marginTop={1} stickyScroll={false}>
          <ResultCard
            store={store}
            view={view}
            width={Math.max(30, width - 6)}
            onOpen={onOpen}
            onMore={onMore}
            loadingMore={loadingMore}
          />
        </scrollbox>
      ) : (
        <text fg={COLORS.faint} marginTop={1} content={empty} />
      )}
    </box>
  )
}
