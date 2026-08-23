import { describe, expect, test } from 'bun:test'
import { buildTransactionListRecord, createResultStore, type ResultStore } from '@initlabs/vibekit-explorer'

import { loadNextPage, viewFor } from '../src/slices/lookup.js'
import type { ExplorerHost } from '../src/slices/network.js'

const SENDER = 'WPR5O4HW43WM3R3RIGE7XT5QH3TSNER4VYJIGIT2CGS2SKX7P2Y724JCSQ'
const identity = (n: number) => ({ resultId: `r${n}`, toolCallId: `t${n}`, network: 'localnet' })
const row = (id: string) => ({ id, type: 'pay', sender: SENDER, paymentAmountMicroAlgos: 1 })

describe('loadNextPage', () => {
  test('fetches with the echoed scope, merges, and returns a view over the merged record', async () => {
    const first = buildTransactionListRecord(identity(1), {
      transactions: [row('A')],
      nextToken: 'tok',
      query: { address: SENDER },
    })
    const second = buildTransactionListRecord(identity(2), { transactions: [row('B'), row('C')] })
    const storeRef = { current: createResultStore([first]) as ResultStore }
    const calls: unknown[] = []
    const host = {
      searchTransactions: async (filter: unknown) => {
        calls.push(filter)
        return second
      },
    } as unknown as ExplorerHost
    const next = await loadNextPage({
      host,
      storeRef,
      commitStore: (store) => {
        storeRef.current = store
      },
      network: 'localnet',
      view: viewFor(first, 'transaction.list'),
    })
    expect(calls).toEqual([{ nextToken: 'tok', address: SENDER }])
    expect(next?.view).toBe('transaction.list')
    const merged = storeRef.current.find((record) => record.resultId === next?.source.id)
    expect(merged?.state).toBe('success')
    const data = merged?.state === 'success' ? (merged.data as { transactions: unknown[]; nextToken?: string }) : undefined
    expect(data?.transactions).toHaveLength(3)
    expect(data?.nextToken).toBeUndefined()
    // Last page: nothing more to fetch.
    expect(await loadNextPage({ host, storeRef, commitStore: () => {}, network: 'localnet', view: next! })).toBeUndefined()
  })
})
