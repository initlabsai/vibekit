'use client'

import { formatBlockTxnType, formatExplorerTime, type BlockDetailViewModel } from '@initlabs/vibekit-explorer'

import { algo, MoreFooter, Table, type Column } from '../../generic-cards'
import { Button, Chip, Copyable, Fact, Facts, FooterNote, Frame, Header, Hero, Unavailable } from '../../primitives'
import { shorten } from '../../theme'

export function BlockCard({
  model,
  onTransactions,
  onOpenBlock,
}: {
  model: BlockDetailViewModel | undefined
  onTransactions?: () => void
  onOpenBlock?: (round: number) => void
}) {
  if (!model) return <Unavailable title="BLOCK" />
  const roundLink = (round: number) =>
    onOpenBlock ? <Button label={String(round)} onPress={() => onOpenBlock(round)} /> : <Copyable value={String(round)} />
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
          {model.transactionTypes.length === 0
            ? String(model.transactionCount)
            : model.transactionTypes.map((entry) => (
                <Chip
                  key={entry.type}
                  label={entry.count === 1 ? formatBlockTxnType(entry.type) : `${formatBlockTxnType(entry.type)} ${entry.count}`}
                />
              ))}
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

type BlockRow = { round: number; timestamp: number; transactionCount: number; proposer?: string }

export function BlockListCard({
  blocks,
  nextToken,
  onMore,
  loadingMore,
  onOpen,
}: {
  blocks: ReadonlyArray<BlockRow>
  nextToken?: string
  onMore?: () => void
  loadingMore?: boolean
  onOpen?: (round: number) => void
}) {
  const columns: Column<BlockRow>[] = [
    { key: 'round', label: 'round', width: 'minmax(6rem, .7fr)', sortValue: (b) => b.round, cell: (b) => <span className="tt-kind">{b.round}</span> },
    { key: 'time', label: 'time', sortValue: (b) => b.timestamp, cell: (b) => formatExplorerTime(b.timestamp) },
    { key: 'txns', label: 'txns', align: 'right', width: 'minmax(4rem, .5fr)', sortValue: (b) => b.transactionCount, cell: (b) => String(b.transactionCount) },
    {
      key: 'proposer',
      label: 'proposer',
      width: 'minmax(8rem, 1.2fr)',
      cell: (b) => (b.proposer ? <Copyable value={b.proposer} display={shorten(b.proposer, 16)} /> : ''),
    },
  ]
  return (
    <Frame>
      <Header kicker="BLOCKS" pill={String(blocks.length)} tone="idle" />
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
