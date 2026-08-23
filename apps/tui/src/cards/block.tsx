import {
  formatBlockTxnType,
  formatExplorerTime,
  type BlockDetailViewModel,
} from '@initlabs/vibekit-explorer'

import { COLORS } from '../theme.js'
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
} from '../ui.js'
import { algo, pageNotes } from './shared.js'

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
        action={onTransactions ? <Button label="transactions ▸" onPress={onTransactions} /> : undefined}
      />
      <Hero value={`round ${model.round}`} copy={String(model.round)} />
      <box marginTop={1} flexDirection="column">
        <Rule width={body} />
        <Fact label="time" value={formatExplorerTime(model.timestamp)} width={body} />
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
        <Fact
          label="proposer"
          value={model.proposer ?? '—'}
          copy={model.proposer}
          width={body}
        />
        <Fact
          label="fees"
          value={
            model.feesCollectedMicroAlgos === undefined
              ? '—'
              : (algo(model.feesCollectedMicroAlgos) ?? '—')
          }
          width={body}
        />
        {model.proposerPayoutMicroAlgos === undefined ? null : (
          <Fact label="payout" value={algo(model.proposerPayoutMicroAlgos) ?? '—'} width={body} />
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
  onOpen?: (round: number) => void
}) {
  const body = innerWidth(width)
  const rows = blocks.slice(0, 10)
  return (
    <Frame width={width}>
      <Header kicker="BLOCKS" pill={String(blocks.length)} tone="idle" />
      <box flexDirection="column">
        {rows.map((block, index) => (
          <box key={block.round} flexDirection="column" marginTop={1}>
            <box flexDirection="row" justifyContent="space-between" height={1}>
              <Fact
                label="round"
                value={String(block.round)}
                copy={String(block.round)}
                width={body - 12}
              />
              {onOpen ? <Button label="open ▸" onPress={() => onOpen(block.round)} /> : null}
            </box>
            <Fact label="time" value={formatExplorerTime(block.timestamp)} width={body} />
            <Fact
              label="txns"
              value={`${block.transactionCount} txn${block.transactionCount === 1 ? '' : 's'}`}
              width={body}
            />
            {block.proposer ? (
              <Fact label="proposer" value={block.proposer} copy={block.proposer} width={body} />
            ) : null}
            {index < rows.length - 1 ? <Rule width={body} /> : null}
          </box>
        ))}
        {pageNotes(blocks.length, rows.length, nextToken).map((note) => (
          <FooterNote key={note} text={note} width={body} />
        ))}
      </box>
    </Frame>
  )
}
