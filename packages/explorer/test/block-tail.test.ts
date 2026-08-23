import { describe, expect, test } from 'bun:test'
import algosdk from 'algosdk'

import { FIXTURE_RECEIVER, FIXTURE_SENDER } from '../src/index.js'
import { formatAlgodTransaction } from '../src/live/algod-txn.js'
import {
  matchesInTick,
  runBlockTail,
  tickFromAlgodBlock,
  withRelated,
  type BlockTailClock,
  type BlockTailTick,
} from '../src/live/block-tail.js'

const params: algosdk.SuggestedParamsWithMinFee = {
  fee: 1000,
  firstValid: 1,
  lastValid: 1001,
  genesisID: 'test',
  genesisHash: new Uint8Array(32),
  minFee: 1000,
}

function payTxn(sender = FIXTURE_SENDER, receiver = FIXTURE_RECEIVER) {
  return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver,
    amount: 250_000,
    suggestedParams: params,
  })
}

function tick(round: number): BlockTailTick {
  return tickFromAlgodBlock(
    { resultId: `r-${round}`, toolCallId: `t-${round}`, network: 'localnet' },
    { round, timestamp: 1_700_000_000 + round },
    [{ txn: payTxn() }],
  )
}

describe('algod transaction formatting', () => {
  test('a payment carries sender, receiver, amount, and a txid when extras say so', () => {
    const txn = payTxn()
    const formatted = formatAlgodTransaction(txn, {
      id: txn.txID(),
      confirmedRound: 22,
      roundTime: 1787169189,
    })
    expect(formatted).toMatchObject({
      type: 'pay',
      sender: FIXTURE_SENDER,
      receiver: FIXTURE_RECEIVER,
      paymentAmountMicroAlgos: 250000,
      confirmedRound: 22,
    })
    expect(typeof formatted.feeMicroAlgos === 'number' && formatted.feeMicroAlgos >= 1000).toBe(true)
    expect(formatted.id).toBe(txn.txID())
  })
})

describe('tickFromAlgodBlock', () => {
  test('builds block.detail and transaction.list records that view models accept', () => {
    const result = tick(22)
    expect(result.round).toBe(22)
    expect(result.block).toMatchObject({
      toolName: 'lookup_block',
      state: 'success',
      data: { round: 22, transactionCount: 1 },
    })
    expect(result.transactions).toMatchObject({
      toolName: 'search_transactions',
      state: 'success',
    })
    const data = result.transactions.data as { transactions: Array<{ sender: string; type?: string }> }
    expect(data.transactions[0]?.sender).toBe(FIXTURE_SENDER)
    expect(data.transactions[0]?.type).toBe('pay')
  })

  test('an empty payset is a 0-txn block, not an error', () => {
    const result = tickFromAlgodBlock(
      { resultId: 'r', toolCallId: 't', network: 'localnet' },
      { round: 9, timestamp: 1 },
      [],
    )
    expect(result.block.data).toMatchObject({ round: 9, transactionCount: 0 })
    expect(result.transactions.data).toMatchObject({ transactions: [] })
  })
})

describe('matchesInTick', () => {
  test('hits watched accounts, assets, and apps and de-dupes', () => {
    const txns = [
      {
        sender: FIXTURE_SENDER,
        receiver: FIXTURE_RECEIVER,
        feeMicroAlgos: 1000,
        assetId: 1042,
        applicationId: 1071,
      },
      {
        sender: FIXTURE_SENDER,
        feeMicroAlgos: 1000,
        createdAssetId: 1042,
      },
    ]
    const matches = matchesInTick(txns, {
      addresses: [FIXTURE_SENDER],
      assetIds: [1042],
      applicationIds: [1071],
    })
    expect(matches).toEqual([
      { kind: 'account', address: FIXTURE_SENDER },
      { kind: 'asset', assetId: 1042 },
      { kind: 'application', applicationId: 1071 },
    ])
  })

  test('withRelated is empty when the watch set is empty', () => {
    expect(withRelated(tick(1), {}).related).toEqual([])
    expect(withRelated(tick(1), { addresses: [FIXTURE_SENDER] }).related).toEqual([
      { kind: 'account', address: FIXTURE_SENDER },
    ])
  })
})

describe('runBlockTail', () => {
  test('emits each subsequent round and stops on abort', async () => {
    const emitted: number[] = []
    const abort = new AbortController()
    let waits = 0
    const clock: BlockTailClock = {
      async status() {
        return { lastRound: 10 }
      },
      async waitAfter(round) {
        waits += 1
        if (waits > 3) {
          abort.abort()
          return { lastRound: round }
        }
        return { lastRound: round + 1 }
      },
      async fetchRound(round) {
        return tick(round)
      },
    }
    await runBlockTail(clock, {
      signal: abort.signal,
      onTick: (entry) => {
        emitted.push(entry.round)
      },
    })
    expect(emitted).toEqual([11, 12, 13])
  })

  test('a reconnect gap skips ahead instead of replaying the whole chain', async () => {
    const emitted: number[] = []
    const abort = new AbortController()
    let waits = 0
    const clock: BlockTailClock = {
      async status() {
        return { lastRound: 10 }
      },
      async waitAfter() {
        waits += 1
        if (waits === 1) return { lastRound: 40 }
        abort.abort()
        return { lastRound: 40 }
      },
      async fetchRound(round) {
        return tick(round)
      },
    }
    await runBlockTail(clock, {
      signal: abort.signal,
      onTick: (entry) => {
        emitted.push(entry.round)
      },
    })
    expect(emitted[0]).toBe(33)
    expect(emitted.at(-1)).toBe(40)
    expect(emitted).toHaveLength(8)
  })
})

describe('payset transaction ids', () => {
  test('restores the genesis fields the block encoding stripped', () => {
    // A payset transaction arrives without gen/gh; hashing it as-is yields an
    // id that matches nothing on chain.
    const signed = payTxn()
    const onChainId = signed.txID()
    const stripped = algosdk.Transaction.fromEncodingData(
      (() => {
        const data = signed.toEncodingData()
        data.delete('gen')
        data.delete('gh')
        return data
      })(),
    )
    expect(stripped.txID()).not.toBe(onChainId)

    const result = tickFromAlgodBlock(
      { resultId: 'r-gen', toolCallId: 't-gen', network: 'localnet' },
      {
        round: 42,
        timestamp: 1_700_000_042,
        genesisID: params.genesisID,
        genesisHash: params.genesisHash,
      },
      [{ txn: stripped, hasGenesisID: true, hasGenesisHash: true }],
    )
    if (result.transactions.state !== 'success') throw new Error('expected success')
    const rows = (result.transactions.data as { transactions: Array<{ id?: string }> }).transactions
    expect(rows[0]?.id).toBe(onChainId)
  })
})

describe('runBlockTail failure handling', () => {
  test('a mid-catch-up failure does not replay rounds already emitted', async () => {
    const emitted: number[] = []
    const abort = new AbortController()
    let failed = false
    let waits = 0
    const clock: BlockTailClock = {
      async status() {
        return { lastRound: 10 }
      },
      async waitAfter() {
        waits += 1
        if (waits > 2) {
          abort.abort()
          return { lastRound: 14 }
        }
        return { lastRound: 14 }
      },
      async fetchRound(round) {
        if (round === 13 && !failed) {
          failed = true
          throw new Error('indexer hiccup')
        }
        return tick(round)
      },
    }
    await runBlockTail(clock, { signal: abort.signal, onTick: (t) => void emitted.push(t.round) })
    // 11 and 12 emitted before the throw; the retry resumes at 13, never repeats.
    expect(emitted).toEqual([...new Set(emitted)])
    expect(emitted.slice(0, 2)).toEqual([11, 12])
  })
})
