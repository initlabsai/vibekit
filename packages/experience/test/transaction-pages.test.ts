import { describe, expect, test } from 'bun:test'

import {
  buildTransactionListRecord,
  mergeTransactionPages,
  nextPageFilter,
} from '../src/views/transaction.js'

const SENDER = 'WPR5O4HW43WM3R3RIGE7XT5QH3TSNER4VYJIGIT2CGS2SKX7P2Y724JCSQ'
const identity = (n: number) => ({ resultId: `r${n}`, toolCallId: `t${n}`, network: 'localnet' })
const row = (id: string) => ({ id, type: 'pay', sender: SENDER, paymentAmountMicroAlgos: 1 })

describe('transaction pages', () => {
  test('nextPageFilter rebuilds the scope from the query echo', () => {
    const page = buildTransactionListRecord(identity(1), {
      transactions: [row('A')],
      nextToken: 'tok',
      query: { address: SENDER, txType: 'pay', assetId: 7 },
    })
    expect(nextPageFilter(page)).toEqual({ nextToken: 'tok', address: SENDER, txType: 'pay', assetId: 7 })
    const round = buildTransactionListRecord(identity(2), {
      transactions: [],
      nextToken: 'tok',
      query: { minRound: 5, maxRound: 5 },
    })
    expect(nextPageFilter(round)).toEqual({ nextToken: 'tok', round: 5 })
    const last = buildTransactionListRecord(identity(3), { transactions: [row('A')] })
    expect(nextPageFilter(last)).toBeUndefined()
  })

  test('mergeTransactionPages concatenates rows and keeps the newer token', () => {
    const first = buildTransactionListRecord(identity(1), {
      transactions: [row('A')],
      nextToken: 'one',
      query: { address: SENDER },
    })
    const second = buildTransactionListRecord(identity(2), { transactions: [row('B')] })
    const merged = mergeTransactionPages(first, second, identity(3))
    expect(merged.state).toBe('success')
    const data = merged.state === 'success' ? (merged.data as { transactions: unknown[]; nextToken?: string; query?: unknown }) : undefined
    expect(data?.transactions).toHaveLength(2)
    expect(data?.nextToken).toBeUndefined()
    expect(data?.query).toEqual({ address: SENDER })
    expect(nextPageFilter(merged)).toBeUndefined()
  })
})
