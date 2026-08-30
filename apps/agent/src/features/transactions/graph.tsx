'use client'

/** The flow graph as a card: one column per entity, one row per transaction, from the shared graph model. */
import algosdk from 'algosdk'
import {
  buildTransactionsGraph,
  type GraphTransaction,
  type TransactionRowData,
  type TransactionsGraph,
} from '@initlabs/vibekit-explorer'
import type { ReactNode } from 'react'

import { Fact, Facts, FooterNote, Frame, Header } from '../../primitives'
import { TransactionsGraphView } from '../action/graph'

function toGraphTransaction(row: TransactionRowData): GraphTransaction {
  // Spread, then coerce: ids arrive as number | string on the wire.
  const { assetId, applicationId, createdAssetId, createdApplicationId, innerTxns, ...rest } = row
  return {
    ...rest,
    feeMicroAlgos: row.feeMicroAlgos ?? 0,
    ...(assetId === undefined ? {} : { assetId: Number(assetId) }),
    ...(applicationId === undefined ? {} : { applicationId: Number(applicationId) }),
    ...(createdAssetId === undefined ? {} : { createdAssetId: Number(createdAssetId) }),
    ...(createdApplicationId === undefined ? {} : { createdApplicationId: Number(createdApplicationId) }),
    ...(innerTxns === undefined ? {} : { innerTxns: innerTxns.map(toGraphTransaction) }),
  }
}

/** The graph for a list of rows, or undefined when the model has nothing to draw. */
export function buildGroupGraph(rows: readonly TransactionRowData[]): TransactionsGraph | undefined {
  if (rows.length === 0) return undefined
  try {
    const graph = buildTransactionsGraph(rows.map(toGraphTransaction), {
      appAddressFor: (applicationId) => algosdk.getApplicationAddress(applicationId).toString(),
    })
    return graph.horizontals.length > 0 ? graph : undefined
  } catch {
    return undefined
  }
}

export function TransactionGraphCard({
  graph,
  groupId,
  transactionCount,
  kicker = 'TRANSACTION GROUP',
  action,
}: {
  graph: TransactionsGraph
  groupId?: string
  transactionCount: number
  kicker?: string
  action?: ReactNode
}) {
  const tags = graph.horizontals.flatMap((row) => {
    const { representation } = row
    return [representation.fromTag, 'toTag' in representation ? representation.toTag : undefined]
  })
  const legend = [
    tags.some((tag) => typeof tag === 'number') ? '(n) account n' : null,
    graph.horizontals.some((row) => row.representation.kind === 'selfLoop') ? '↺ to itself' : null,
    tags.includes('rekey') ? '(rk) rekeyed — the app acts as that account' : null,
  ].filter(Boolean)
  return (
    <Frame>
      <Header kicker={kicker} chip="FLOW" pill={String(transactionCount)} tone="idle" action={action} />
      {groupId ? (
        <Facts>
          <Fact label="group" value={groupId} copy={groupId} open={false} />
        </Facts>
      ) : null}
      <TransactionsGraphView graph={graph} />
      {legend.length > 0 ? <FooterNote text={legend.join(' · ')} /> : null}
    </Frame>
  )
}
