import { describe, expect, test } from 'bun:test'
import {
  buildAssetHoldingsRecord,
  createResultStore,
  type ResultStore,
} from '@initlabs/vibekit-explorer'

import { loadNextPage, viewFor } from '../src/lookup.js'
import type { ExplorerHost } from '../src/features/network/hooks.js'

const SENDER = 'WPR5O4HW43WM3R3RIGE7XT5QH3TSNER4VYJIGIT2CGS2SKX7P2Y724JCSQ'
const identity = (n: number, input?: Record<string, string | number>) => ({
  resultId: `r${n}`,
  toolCallId: `t${n}`,
  network: 'localnet',
  ...(input ? { input } : {}),
})
const holding = (assetId: number) => ({ assetId, amount: '1', isFrozen: false })

describe('loadNextPage', () => {
  test("re-runs the record's own call with its token, merges, and returns a view over the merged record", async () => {
    const first = buildAssetHoldingsRecord(identity(1, { address: SENDER }), {
      address: SENDER,
      assets: [holding(1)],
      nextToken: 'tok',
    })
    const second = buildAssetHoldingsRecord(identity(2), {
      address: SENDER,
      assets: [holding(2), holding(3)],
    })
    const storeRef = { current: createResultStore([first]) as ResultStore }
    const calls: unknown[] = []
    const host = {
      callTool: async (toolName: string, args: unknown) => {
        calls.push([toolName, args])
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
      view: viewFor(first, 'asset.holdings'),
    })
    expect(calls).toEqual([['get_account_assets', { address: SENDER, nextToken: 'tok' }]])
    expect(next?.view).toBe('asset.holdings')
    const merged = storeRef.current.find((record) => record.resultId === next?.source.id)
    const data =
      merged?.state === 'success'
        ? (merged.data as { assets: unknown[]; nextToken?: string })
        : undefined
    expect(data?.assets).toHaveLength(3)
    expect(data?.nextToken).toBeUndefined()
    // Last page: nothing more to fetch.
    expect(
      await loadNextPage({
        host,
        storeRef,
        commitStore: () => {},
        network: 'localnet',
        view: next!,
      }),
    ).toBeUndefined()
  })
})
