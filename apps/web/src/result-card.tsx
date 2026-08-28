'use client'

/** The one place a view id becomes UI: every trusted view spec renders through this switch. */
import {
  createAccountPortfolioViewModel,
  createTransactionDetailViewModel,
  findResultRecord,
  type ResultStore,
  type TransactionSearchFilter,
  type ViewSpec,
} from '@initlabs/vibekit-explorer'

import { Facts, Fact, Frame, Header } from './primitives'
import { AccountView, TransactionDetail } from './views'

/** Where a card's touchable can take the feed; UI routing, not protocol. */
export type OpenTarget =
  | { kind: 'transaction'; txid: string }
  | { kind: 'account'; address: string }
  | { kind: 'asset'; assetId: number }
  | { kind: 'application'; applicationId: number }
  | { kind: 'block'; round: number }
  | { kind: 'transactions'; filter: TransactionSearchFilter }
  | { kind: 'holdings'; address: string }

/** A record whose view has no card of its own: its top-level scalars as facts. */
export function RawCard({ store, view }: { store: ResultStore; view: ViewSpec }) {
  const record = findResultRecord(store, view.source)
  if (!record) return null
  const data = record.state === 'success' ? record.data : record.error
  const entries =
    data !== null && typeof data === 'object' && !Array.isArray(data)
      ? Object.entries(data).filter(([, value]) => typeof value !== 'object' || value === null)
      : []
  return (
    <Frame>
      <Header
        kicker={view.view.toUpperCase()}
        chip={record.network}
        pill={record.state === 'error' ? 'FAILED' : undefined}
        tone="bad"
      />
      <Facts>
        {entries.map(([key, value]) => (
          <Fact key={key} label={key} value={String(value)} />
        ))}
      </Facts>
    </Frame>
  )
}

export function ResultCard({
  store,
  view,
  onOpen,
}: {
  store: ResultStore
  view: ViewSpec
  onOpen: (target: OpenTarget) => void
}) {
  switch (view.view) {
    case 'transaction.detail': {
      const derived = createTransactionDetailViewModel(store, view)
      return (
        <TransactionDetail
          model={derived.ok ? derived.model : undefined}
          onOpenAccount={(address) => onOpen({ kind: 'account', address })}
        />
      )
    }
    case 'account.portfolio': {
      const derived = createAccountPortfolioViewModel(store, view)
      return <AccountView model={derived.ok ? derived.model : undefined} />
    }
    default:
      return <RawCard store={store} view={view} />
  }
}
