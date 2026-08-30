import { describe, expect, test } from 'bun:test'

import { buildAssetHoldingsRecord, loadNextPage, mergePages, nextPageArgs } from '../../src/views/index.js'
import { buildTransactionListRecord } from '../../src/views/transaction.js'

const SENDER = 'WPR5O4HW43WM3R3RIGE7XT5QH3TSNER4VYJIGIT2CGS2SKX7P2Y724JCSQ'
const identity = (n: number, input?: Record<string, string | number>) => ({
  resultId: `r${n}`,
  toolCallId: `t${n}`,
  network: 'localnet',
  ...(input ? { input } : {}),
})
const row = (id: string) => ({ id, type: 'pay', sender: SENDER, paymentAmountMicroAlgos: 1 })

describe('paged records', () => {
  test("nextPageArgs is the record's own call plus its token", () => {
    const page = buildTransactionListRecord(identity(1, { address: SENDER, limit: 20 }), {
      transactions: [row('A')],
      nextToken: 'tok',
    })
    expect(nextPageArgs(page)).toEqual({ address: SENDER, limit: 20, nextToken: 'tok' })
    // Final page, or a record that does not know its call: nothing to fetch.
    expect(
      nextPageArgs(
        buildTransactionListRecord(identity(2, { address: SENDER }), { transactions: [] }),
      ),
    ).toBeUndefined()
    expect(
      nextPageArgs(buildTransactionListRecord(identity(3), { transactions: [], nextToken: 'tok' })),
    ).toBeUndefined()
    expect(nextPageArgs(undefined)).toBeUndefined()
  })

  test('mergePages appends the list the view renders and keeps the first call', () => {
    const first = buildTransactionListRecord(identity(1, { address: SENDER }), {
      transactions: [row('A')],
      nextToken: 'one',
      address: SENDER,
    })
    const second = buildTransactionListRecord(identity(2, { address: SENDER, nextToken: 'one' }), {
      transactions: [row('B'), row('C')],
      address: SENDER,
    })
    const merged = mergePages('transaction.list', first, second, identity(3))
    expect(merged.state).toBe('success')
    const data =
      merged.state === 'success'
        ? (merged.data as { transactions: unknown[]; nextToken?: string; address?: string })
        : undefined
    expect(data?.transactions).toHaveLength(3)
    expect(data?.nextToken).toBeUndefined()
    expect(data?.address).toBe(SENDER)
    expect(merged.input).toEqual({ address: SENDER })
    expect(nextPageArgs(merged)).toBeUndefined()
  })

  test('every paged list view merges, not only transactions', () => {
    const first = buildAssetHoldingsRecord(identity(1, { address: SENDER }), {
      address: SENDER,
      assets: [{ assetId: 1, amount: '1', isFrozen: false }],
      nextToken: 'n',
    })
    const next = buildAssetHoldingsRecord(identity(2), {
      address: SENDER,
      assets: [{ assetId: 2, amount: '5', isFrozen: false }],
    })
    const merged = mergePages('asset.holdings', first, next, identity(3))
    expect(
      merged.state === 'success' && (merged.data as { assets: unknown[] }).assets,
    ).toHaveLength(2)
    expect(() => mergePages('transaction.detail', first, next, identity(4))).toThrow(
      /not a paged list/,
    )
  })

  test('loadNextPage re-runs the record\'s own call with its token and merges the page', async () => {
    const first = buildTransactionListRecord(identity(1, { address: SENDER }), {
      transactions: [row('A')],
      nextToken: 'one',
    })
    const calls: Array<[string, Record<string, unknown>]> = []
    const host = {
      callTool: async (toolName: string, args: Record<string, unknown>) => {
        calls.push([toolName, args])
        return buildTransactionListRecord(identity(2, { address: SENDER, nextToken: 'one' }), {
          transactions: [row('B')],
        })
      },
    }
    const merged = await loadNextPage({ host, current: first, view: 'transaction.list', identity: identity(3) })
    expect(calls).toEqual([[first.toolName, { address: SENDER, nextToken: 'one' }]])
    expect(merged?.state === 'success' && (merged.data as { transactions: unknown[] }).transactions).toHaveLength(2)
    // A final page fetches nothing.
    expect(await loadNextPage({ host, current: merged, view: 'transaction.list', identity: identity(4) })).toBeUndefined()
    expect(calls).toHaveLength(1)
  })
})
