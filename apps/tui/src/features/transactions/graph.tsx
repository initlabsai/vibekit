import type { TransactionsGraph } from '@initlabs/vibekit/views'

import {
  Button,
  Fact,
  FooterNote,
  Frame,
  GraphSpanText,
  Header,
  innerWidth,
} from '../../primitives.js'
import { computeGraphLayout, LOOP } from './graph-layout.js'

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
  const tags = graph.horizontals.flatMap((row) => {
    const { representation } = row
    return [representation.fromTag, 'toTag' in representation ? representation.toTag : undefined]
  })
  const legend = [
    tags.some((tag) => typeof tag === 'number') ? '(n) account n' : null,
    graph.horizontals.some((row) => row.representation.kind === 'selfLoop')
      ? `${LOOP} to itself`
      : null,
    tags.includes('rekey') ? '(rk) rekeyed — the app acts as that account' : null,
  ].filter(Boolean)

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
              <GraphSpanText key={spanIndex} text={span.text} fg={span.fg} copy={span.copy} />
            ))}
          </box>
        ))}
      </box>
      {legend.length > 0 ? <FooterNote text={legend.join(' · ')} width={body} /> : null}
    </Frame>
  )
}
