import { formatBlockTxnType, formatTime, type BlockDetailViewModel } from '@initlabs/vibekit/views'

import { COLORS } from '../../theme.js'
import {
  Button,
  Chip,
  Fact,
  FooterNote,
  Frame,
  Header,
  Hero,
  innerWidth,
  Rule,
  Unavailable,
} from '../../primitives.js'
import { ListCard, algo } from '../../generic-cards.js'

export function BlockCard({
  model,
  width,
  onTransactions,
}: {
  model: BlockDetailViewModel | undefined
  width: number
  onTransactions?: () => void
}) {
  if (!model) return <Unavailable title="BLOCK" width={width} />
  const body = innerWidth(width)
  return (
    <Frame width={width}>
      <Header
        kicker="BLOCK"
        pill={model.network.toUpperCase()}
        tone="idle"
        action={
          onTransactions ? <Button label="transactions ▸" onPress={onTransactions} /> : undefined
        }
      />
      <Hero value={`round ${model.round}`} copy={String(model.round)} />
      <box marginTop={1} flexDirection="column">
        <Rule width={body} />
        <Fact label="time" value={formatTime(model.timestamp)} width={body} />
        <box flexDirection="row" height={1}>
          <text fg={COLORS.faint} content={'txns'.padEnd(10)} />
          {model.transactionTypes.length === 0 ? (
            <text fg={COLORS.text}>{String(model.transactionCount)}</text>
          ) : (
            <box flexDirection="row">
              {model.transactionTypes.map((entry, index) => (
                <box key={entry.type} flexDirection="row">
                  {index > 0 ? <text> </text> : null}
                  <Chip
                    label={
                      entry.count === 1
                        ? formatBlockTxnType(entry.type)
                        : `${formatBlockTxnType(entry.type)} ${entry.count}`
                    }
                  />
                </box>
              ))}
              <text fg={COLORS.muted}>{`  ${model.transactionCount} total`}</text>
            </box>
          )}
        </box>
        <Fact label="proposer" value={model.proposer ?? '—'} copy={model.proposer} width={body} />
        <Fact
          label="fees"
          value={
            model.feesCollectedMicroAlgos === undefined ? '—' : algo(model.feesCollectedMicroAlgos)
          }
          width={body}
        />
        {model.proposerPayoutMicroAlgos === undefined ? null : (
          <Fact label="payout" value={algo(model.proposerPayoutMicroAlgos)} width={body} />
        )}
        {model.previousRound === undefined ? null : (
          <Fact
            label="prev"
            value={String(model.previousRound)}
            copy={String(model.previousRound)}
            width={body}
          />
        )}
        {model.nextRound === undefined ? null : (
          <Fact
            label="next"
            value={String(model.nextRound)}
            copy={String(model.nextRound)}
            width={body}
          />
        )}
      </box>
    </Frame>
  )
}

export function BlockListCard({
  blocks,
  nextToken,
  width,
  onMore,
  loadingMore,
  onOpen,
}: {
  blocks: ReadonlyArray<{
    round: number
    timestamp: number
    transactionCount: number
    proposer?: string
  }>
  nextToken?: string
  width: number
  /** Fetches the next page into this card; present only when the record can. */
  onMore?: () => void
  loadingMore?: boolean
  onOpen?: (round: number) => void
}) {
  return (
    <ListCard
      kicker="BLOCKS"
      pill={String(blocks.length)}
      rows={blocks}
      keyOf={(block) => String(block.round)}
      lead={(block) => ({ label: 'round', value: String(block.round), copy: String(block.round) })}
      onOpen={onOpen && ((block) => onOpen(block.round))}
      facts={(block, body) => (
        <>
          <Fact label="time" value={formatTime(block.timestamp)} width={body} />
          <Fact
            label="txns"
            value={`${block.transactionCount} txn${block.transactionCount === 1 ? '' : 's'}`}
            width={body}
          />
          {block.proposer ? (
            <Fact label="proposer" value={block.proposer} copy={block.proposer} width={body} />
          ) : null}
        </>
      )}
      nextToken={nextToken}
      onMore={onMore}
      loadingMore={loadingMore}
      width={width}
    />
  )
}
