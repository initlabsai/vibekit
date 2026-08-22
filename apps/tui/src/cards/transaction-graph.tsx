import type { TransactionsGraph } from '@initlabs/vibekit-experience'

import { Button, Fact, Frame, Header, innerWidth } from '../ui.js'
import { computeGraphLayout } from './transaction-graph-layout.js'

/**
 * Swimlane flow graph for a transaction group: one column per entity, one
 * row per transaction, exactly as the TransactionsGraph model emits them.
 * All layout lives in transaction-graph-layout.ts; this is the JSX shell.
 */
export function TransactionGraphCard({
  graph,
  groupId,
  transactionCount,
  kicker = 'TRANSACTION GROUP',
  width,
  onShowTable,
}: {
  graph: TransactionsGraph
  groupId?: string
  transactionCount: number
  kicker?: string
  width: number
  /** Switch this card to the row table. */
  onShowTable?: () => void
}) {
  const body = innerWidth(width)
  const layout = computeGraphLayout(graph, body)
  return (
    <Frame width={width}>
      <Header
        kicker={kicker}
        chip={layout.mode === 'lanes' ? 'FLOW' : 'FLOW LIST'}
        pill={String(transactionCount)}
        tone="idle"
        action={onShowTable ? <Button label="table" onPress={onShowTable} /> : undefined}
      />
      {groupId ? <Fact label="group" value={groupId} copy={groupId} width={body} /> : null}
      <box flexDirection="column" marginTop={1}>
        {layout.lines.map((line, index) => (
          <box key={index} flexDirection="row" height={1}>
            {line.map((span, spanIndex) => (
              <text key={spanIndex} fg={span.fg} content={span.text} />
            ))}
          </box>
        ))}
      </box>
    </Frame>
  )
}
