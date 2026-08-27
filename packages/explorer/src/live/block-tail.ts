/**
 * Algod wait-for-block tail: a plain loop over statusAfterBlock that emits
 * the same block.detail and transaction.list records the lookup tools already
 * produce. Renderers append those records to the feed; this module never
 * owns UI.
 */
import type { FormattedTransaction } from '@initlabs/vibekit/tools'

import type { ResultIdentity, StructuredResult } from '../core/results.js'
import { buildBlockDetailRecord } from '../views/block.js'
import { buildTransactionListRecord } from '../views/transaction.js'
import { formatAlgodTransaction, safeUint64, txIdInBlock, typeCounts } from './algod-txn.js'
import type algosdk from 'algosdk'

/** How many historical rounds to emit after a reconnect gap. */
const CATCH_UP = 8
/** Retry pause after a wait/fetch failure while the signal is still live. */
const RETRY_MS = 2000
/** Transaction list cards cap so a busy mainnet round cannot flood the feed. */
const TXN_LIMIT = 20

export type BlockTailMatch =
  | { kind: 'account'; address: string }
  | { kind: 'asset'; assetId: number }
  | { kind: 'application'; applicationId: number }

export interface BlockTailWatch {
  addresses?: readonly string[]
  assetIds?: readonly number[]
  applicationIds?: readonly number[]
}

export interface BlockTailTick {
  round: number
  timestamp: number
  block: StructuredResult
  transactions: StructuredResult
  related: BlockTailMatch[]
}

export interface BlockTailClock {
  status(): Promise<{ lastRound: number }>
  /** Resolves when lastRound is greater than `round`. */
  waitAfter(round: number): Promise<{ lastRound: number }>
  fetchRound(round: number): Promise<BlockTailTick>
}

export interface AlgodPaysetEntry {
  txn: algosdk.Transaction
  /** SignedTxnInBlock flags: the block stripped `gen`/`gh` from `txn`. */
  hasGenesisID?: boolean
  hasGenesisHash?: boolean
  apply?: {
    configAsset?: bigint
    applicationID?: bigint
    closingAmount?: bigint
    assetClosingAmount?: bigint
  }
}

export interface AlgodBlockHeader {
  round: bigint | number
  timestamp: bigint | number
  /** Needed to restore each payset transaction's stripped genesis fields. */
  genesisID?: string
  genesisHash?: Uint8Array
  proposer?: { toString(): string }
  feesCollected?: bigint
  proposerPayout?: bigint
}

/** Turns one algod block header + payset into feed-ready records. */
export function tickFromAlgodBlock(
  identity: ResultIdentity,
  header: AlgodBlockHeader,
  payset: readonly AlgodPaysetEntry[],
): BlockTailTick {
  const round = Number(header.round)
  const timestamp = Number(header.timestamp)
  const transactions: FormattedTransaction[] = []
  for (const entry of payset) {
    const id = txIdInBlock(entry.txn, entry, header)
    const createdAsset = entry.apply?.configAsset != null ? Number(entry.apply.configAsset) : 0
    const createdApp = entry.apply?.applicationID != null ? Number(entry.apply.applicationID) : 0
    transactions.push(
      formatAlgodTransaction(entry.txn, {
        ...(id === undefined ? {} : { id }),
        confirmedRound: round,
        roundTime: timestamp,
        ...(createdAsset > 0 ? { createdAssetId: createdAsset } : {}),
        ...(createdApp > 0 ? { createdApplicationId: createdApp } : {}),
        ...(entry.apply?.closingAmount != null
          ? { closeAmountMicroAlgos: safeUint64(entry.apply.closingAmount) }
          : {}),
        ...(entry.apply?.assetClosingAmount != null
          ? { closeAssetAmount: safeUint64(entry.apply.assetClosingAmount) }
          : {}),
      }),
    )
  }
  const page = transactions.slice(0, TXN_LIMIT)
  const proposer = header.proposer?.toString()
  const blockWire = {
    round,
    timestamp,
    transactionCount: transactions.length,
    ...(proposer && proposer.length > 0 ? { proposer } : {}),
    ...(header.feesCollected != null
      ? { feesCollectedMicroAlgos: safeUint64(header.feesCollected) }
      : {}),
    ...(header.proposerPayout != null
      ? { proposerPayoutMicroAlgos: safeUint64(header.proposerPayout) }
      : {}),
    transactionTypes: typeCounts(transactions),
  }
  return {
    round,
    timestamp,
    block: buildBlockDetailRecord(identity, blockWire, 'lookup_block'),
    transactions: buildTransactionListRecord(
      {
        resultId: `${identity.resultId}-txns`,
        toolCallId: `${identity.toolCallId}-txns`,
        network: identity.network,
      },
      { transactions: page },
      'search_transactions',
    ),
    related: [],
  }
}

/** Attaches watch matches to a tick (accounts, assets, apps). */
export function withRelated(tick: BlockTailTick, watch: BlockTailWatch): BlockTailTick {
  if (tick.transactions.state !== 'success') return { ...tick, related: [] }
  const data = tick.transactions.data
  const list =
    data !== null && typeof data === 'object' && !Array.isArray(data)
      ? ((data as { transactions?: FormattedTransaction[] }).transactions ?? [])
      : []
  return { ...tick, related: matchesInTick(list, watch) }
}

export function matchesInTick(
  transactions: readonly FormattedTransaction[],
  watch: BlockTailWatch,
): BlockTailMatch[] {
  const addresses = new Set(watch.addresses ?? [])
  const assets = new Set(watch.assetIds ?? [])
  const apps = new Set(watch.applicationIds ?? [])
  if (addresses.size === 0 && assets.size === 0 && apps.size === 0) return []
  const found: BlockTailMatch[] = []
  const seen = new Set<string>()
  const push = (match: BlockTailMatch) => {
    const key =
      match.kind === 'account'
        ? `account:${match.address}`
        : match.kind === 'asset'
          ? `asset:${match.assetId}`
          : `application:${match.applicationId}`
    if (seen.has(key)) return
    seen.add(key)
    found.push(match)
  }
  for (const txn of transactions) {
    for (const field of [
      txn.sender,
      txn.receiver,
      txn.closeTo,
      txn.clawbackFrom,
      txn.freezeTarget,
      txn.rekeyTo,
      txn.signer,
    ]) {
      if (field && addresses.has(field)) push({ kind: 'account', address: field })
    }
    if (txn.assetId !== undefined && assets.has(txn.assetId)) {
      push({ kind: 'asset', assetId: txn.assetId })
    }
    if (txn.createdAssetId !== undefined && assets.has(txn.createdAssetId)) {
      push({ kind: 'asset', assetId: txn.createdAssetId })
    }
    if (txn.applicationId !== undefined && apps.has(txn.applicationId)) {
      push({ kind: 'application', applicationId: txn.applicationId })
    }
    if (txn.createdApplicationId !== undefined && apps.has(txn.createdApplicationId)) {
      push({ kind: 'application', applicationId: txn.createdApplicationId })
    }
  }
  return found
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

/**
 * Follows algod's lastRound. Starts from the current round and emits each
 * subsequent round. A reconnect gap of more than CATCH_UP rounds skips ahead
 * so a long outage cannot dump the whole chain into the feed.
 */
export async function runBlockTail(
  clock: BlockTailClock,
  options: {
    signal: AbortSignal
    onTick: (tick: BlockTailTick) => void | Promise<void>
    onError?: (error: unknown) => void
  },
): Promise<void> {
  let round: number
  try {
    round = (await clock.status()).lastRound
  } catch (error) {
    options.onError?.(error)
    return
  }
  while (!options.signal.aborted) {
    try {
      const after = await clock.waitAfter(round)
      if (options.signal.aborted) return
      const latest = after.lastRound
      const from = Math.max(round + 1, latest - CATCH_UP + 1)
      for (let next = from; next <= latest; next++) {
        if (options.signal.aborted) return
        const tick = await clock.fetchRound(next)
        if (options.signal.aborted) return
        await options.onTick(tick)
        // Advance per emitted round: a throw mid-catch-up must not replay
        // the rounds already in the feed on the next pass.
        round = next
      }
    } catch (error) {
      if (options.signal.aborted) return
      options.onError?.(error)
      await sleep(RETRY_MS, options.signal)
    }
  }
}
