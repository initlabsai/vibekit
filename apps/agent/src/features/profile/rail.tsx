'use client'

/**
 * The right rail: the account in focus at a glance — identity, balance,
 * top holdings, recent transactions — and the companion. Wide screens show
 * it beside the feed; narrower ones fold it behind a button. The account in
 * focus is the connected wallet's, else the last account opened.
 */
import { addResult, type ResultStore, type ViewSpec } from '@initlabs/vibekit/actions'
import { createAccountPortfolioViewModel, createTransactionCollectionViewModel, formatAssetAmount, formatMicroAlgos, type AccountPortfolioViewModel } from '@initlabs/vibekit/views'
import { useEffect, useMemo, useState } from 'react'

import { formatUsd, useAlgoPrice } from '../../enrich'
import { useExplorer } from '../../explorer'
import { viewFor } from '../../lookup'
import { AssetMark, Avatar, Button, Copyable, Identity } from '../../primitives'
import { shorten } from '../../theme'
import { rowAmount, rowType } from '../transactions/cards'

/** The newest portfolio record in the store, when no wallet is connected. */
function lastOpenedAccount(store: ResultStore): string | undefined {
  for (let i = store.length - 1; i >= 0; i--) {
    const record = store[i]!
    if (record.toolName === 'get_account_portfolio' && record.state === 'success') {
      return (record.data as { address?: string }).address
    }
  }
  return undefined
}

export function ProfileRail({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { store, storeRef, commitStore, host, live, activeAddress, feed, busy, openTarget, network } = useExplorer()
  const focus = activeAddress ?? lastOpenedAccount(store)
  const [portfolio, setPortfolio] = useState<ViewSpec | undefined>(undefined)
  const [recent, setRecent] = useState<ViewSpec | undefined>(undefined)
  const algoPrice = useAlgoPrice()

  // Two reads per focus change; the rail never polls.
  useEffect(() => {
    if (!focus || live !== true) return
    let cancelled = false
    setPortfolio(undefined)
    setRecent(undefined)
    void (async () => {
      try {
        const account = await host().lookupAccount(focus)
        if (cancelled) return
        commitStore(addResult(storeRef.current, account))
        setPortfolio(viewFor(account, 'account.portfolio'))
        const txns = await host().searchTransactions({ address: focus })
        if (cancelled) return
        commitStore(addResult(storeRef.current, txns))
        setRecent(viewFor(txns, 'transaction.list'))
      } catch {
        // The rail is a glance; a failed read leaves it quiet rather than noisy.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [commitStore, focus, host, live, storeRef])

  const account = useMemo(() => {
    if (!portfolio) return undefined
    const derived = createAccountPortfolioViewModel(store, portfolio)
    return derived.ok ? derived.model : undefined
  }, [portfolio, store])
  const txns = useMemo(() => {
    if (!recent) return []
    const derived = createTransactionCollectionViewModel(store, recent)
    return derived.ok ? derived.model.transactions.slice(0, 5) : []
  }, [recent, store])
  const lastError = feed.sections.at(-1)?.items.at(-1)
  const squint = lastError?.kind === 'note' && lastError.tone === 'error'

  // Folded: an app bar — the account's mark, the companion's mood, and the arrow that opens it.
  if (!open) {
    return (
      <aside className="rail rail-mini" aria-label="Account at a glance, folded">
        <button type="button" className="rail-arrow" onClick={onToggle} title="open the rail">
          ◂
        </button>
        {focus ? (
          <button type="button" className="rail-mini-avatar" onClick={onToggle} title={focus}>
            <Avatar address={focus} size={32} />
          </button>
        ) : (
          <span className="rail-mini-dot" aria-hidden="true" />
        )}
        <span className={`rail-mood${squint ? ' squint' : busy ? ' curious' : ''}`} aria-hidden="true">
          {squint ? '(¬_¬)' : busy ? '(・・?)' : '(^‿^)'}
        </span>
      </aside>
    )
  }

  return (
    <aside className="rail" aria-label="Account at a glance">
      <div className="rail-tabs">
        <span className="kicker">account</span>
        <button type="button" className="rail-arrow rail-collapse" onClick={onToggle} title="fold the rail">
          ▸
        </button>
      </div>
      {!focus ? (
        <p className="rail-empty">Connect a wallet or open an account and it lives here.</p>
      ) : (
        <div className="rail-body">
          <Identity address={focus} />
          {account ? (
            <>
              <p className="rail-balance">
                <span className="rail-figure">{formatMicroAlgos(account.balanceMicroAlgos)}</span>
                <span className="rail-unit">
                  ALGO{algoPrice === undefined ? '' : ` · ≈ ${formatUsd((Number(account.balanceMicroAlgos) / 1e6) * algoPrice)}`}
                </span>
              </p>
              <RailHoldings account={account} onOpen={(assetId) => openTarget({ kind: 'asset', assetId })} />
            </>
          ) : (
            <p className="rail-empty">{live === true ? 'reading…' : `needs a live ${network}`}</p>
          )}
          {txns.length > 0 ? (
            <section className="rail-section">
              <span className="kicker">recent</span>
              <ul className="rail-list">
                {txns.map((row, index) => (
                  <li key={row.id ?? index}>
                    <button type="button" className="rail-row" onClick={() => row.id && openTarget({ kind: 'transaction', txid: row.id })}>
                      <span className={`kind kind-${row.type ?? 'txn'}`}>{rowType(row)}</span>
                      <span className="rail-amount">{rowAmount(row) ?? ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <Button label="all transactions ▸" onPress={() => openTarget({ kind: 'transactions', filter: { address: focus } })} />
            </section>
          ) : null}
          {account ? (
            <p className="footnote">
              {account.totalAssets} holding{account.totalAssets === 1 ? '' : 's'} · <Copyable value={focus} display={shorten(focus, 12)} />
            </p>
          ) : null}
        </div>
      )}
    </aside>
  )
}

function RailHoldings({ account, onOpen }: { account: AccountPortfolioViewModel; onOpen: (assetId: number) => void }) {
  const held = account.assets.filter((asset) => Number(asset.amount) > 0).slice(0, 6)
  if (held.length === 0) return null
  return (
    <section className="rail-section">
      <span className="kicker">holdings</span>
      <ul className="rail-list">
        {held.map((asset) => (
          <li key={String(asset.assetId)}>
            <button type="button" className="rail-row" onClick={() => onOpen(Number(asset.assetId))}>
              <AssetMark assetId={asset.assetId} name={asset.name} unitName={asset.unitName} />
              <span className="rail-amount">{formatAssetAmount(asset.amount, asset.decimals)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
