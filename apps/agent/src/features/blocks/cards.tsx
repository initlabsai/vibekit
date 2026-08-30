'use client'

import { formatBlockTxnType, formatExplorerTime, type BlockDetailViewModel } from '@initlabs/vibekit/views'
import { useEffect, useState } from 'react'

import { algo, MoreFooter, Table, type Column } from '../../generic-cards'
import { Button, Copyable, Fact, Facts, FooterNote, Frame, Header, Hero, Unavailable } from '../../primitives'
import { shorten } from '../../theme'

export function BlockCard({
  model,
  onTransactions,
}: {
  model: BlockDetailViewModel | undefined
  onTransactions?: () => void
}) {
  if (!model) return <Unavailable title="BLOCK" />
  const roundLink = (round: number) => <Copyable value={String(round)} open={{ kind: 'block', round }} />
  return (
    <Frame>
      <Header
        kicker="BLOCK"
        pill={model.network.toUpperCase()}
        tone="idle"
        action={onTransactions ? <Button label="transactions ▸" onPress={onTransactions} /> : undefined}
      />
      <Hero value={`round ${model.round}`} copy={String(model.round)} />
      <Facts>
        <Fact label="time" value={formatExplorerTime(model.timestamp)} />
        <Fact label="txns">
          <TxnTags row={model} />
          {model.transactionTypes.length === 0 ? null : <span className="muted"> · {model.transactionCount} total</span>}
        </Fact>
        <Fact label="proposer" value={model.proposer ?? '—'} copy={model.proposer} />
        <Fact label="fees" value={model.feesCollectedMicroAlgos === undefined ? '—' : algo(model.feesCollectedMicroAlgos)} />
        {model.proposerPayoutMicroAlgos === undefined ? null : <Fact label="payout" value={algo(model.proposerPayoutMicroAlgos)} />}
        {model.previousRound === undefined ? null : <Fact label="prev">{roundLink(model.previousRound)}</Fact>}
        {model.nextRound === undefined ? null : <Fact label="next">{roundLink(model.nextRound)}</Fact>}
      </Facts>
    </Frame>
  )
}

type BlockRow = {
  round: number
  timestamp: number
  transactionCount: number
  proposer?: string
  transactionTypes?: ReadonlyArray<{ type: string; count: number }>
}

/** The txns cell: one tag per type with its count, or the bare count when the row has no breakdown. */
function TxnTags({ row }: { row: BlockRow }) {
  if (!row.transactionTypes?.length) return <span className={row.transactionCount === 0 ? 'faint' : undefined}>{row.transactionCount}</span>
  return (
    <span className="txn-tags">
      {row.transactionTypes.map((entry) => (
        <span key={entry.type} className={`kind kind-${entry.type}`} title={formatBlockTxnType(entry.type)}>
          {entry.type}
          {entry.count > 1 ? <b>{entry.count}</b> : null}
        </span>
      ))}
    </span>
  )
}

/** Seconds or minutes since the block, refreshed each second while the card is mounted. */
function Age({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const seconds = Math.max(0, Math.round(now / 1000 - timestamp))
  return <span className="muted">{seconds < 90 ? `${seconds}s` : seconds < 5400 ? `${Math.round(seconds / 60)}m` : `${Math.round(seconds / 3600)}h`}</span>
}

export function BlockListCard({
  blocks,
  nextToken,
  tailing = false,
  onMore,
  loadingMore,
  onOpen,
}: {
  blocks: ReadonlyArray<BlockRow>
  nextToken?: string
  tailing?: boolean
  onMore?: () => void
  loadingMore?: boolean
  onOpen?: (round: number) => void
}) {
  const columns: Column<BlockRow>[] = [
    { key: 'round', label: 'round', width: 'minmax(6rem, .7fr)', sortValue: (b) => b.round, cell: (b) => <span className="tt-kind">{b.round}</span> },
    { key: 'age', label: 'age', width: 'minmax(4rem, .5fr)', cell: (b) => <Age timestamp={b.timestamp} /> },
    { key: 'time', label: 'time', width: 'minmax(12rem, 1fr)', sortValue: (b) => b.timestamp, cell: (b) => formatExplorerTime(b.timestamp) },
    { key: 'txns', label: 'txns', width: 'minmax(9rem, 1.2fr)', sortValue: (b) => b.transactionCount, cell: (b) => <TxnTags row={b} /> },
    {
      key: 'proposer',
      label: 'proposer',
      width: 'minmax(8rem, 1.2fr)',
      cell: (b) => (b.proposer ? <Copyable value={b.proposer} display={shorten(b.proposer, 16)} /> : ''),
    },
  ]
  return (
    <Frame>
      <Header
        kicker="BLOCKS"
        chip={tailing ? 'following the chain' : undefined}
        pill={tailing ? 'LIVE' : String(blocks.length)}
        tone={tailing ? 'ok' : 'idle'}
      />
      {blocks.length === 0 ? (
        <FooterNote text="No blocks." />
      ) : (
        <Table
          columns={columns}
          rows={blocks}
          keyOf={(b) => String(b.round)}
          searchText={(b) => `${b.round} ${b.proposer ?? ''}`}
          onOpen={onOpen ? (b) => onOpen(b.round) : undefined}
        />
      )}
      <MoreFooter count={blocks.length} nextToken={nextToken} onMore={onMore} loadingMore={loadingMore} />
    </Frame>
  )
}
