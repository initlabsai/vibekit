/**
 * Server-side resolvers behind the public entity pages (/transaction, /asset,
 * /application, /block) and their OG images. The chain is the database —
 * nothing is stored. Transactions hit the indexer first (the only durable
 * by-id source) and rescue a seconds-old txn from algod's pending pool;
 * assets, applications, and blocks come straight from algod. Every outcome
 * carries the cache-control its mutability earns, so a miss never sticks and
 * an algod-sourced render graduates to the indexer's immutable one.
 */
import { cache } from 'react'

import { formatBaseUnits, formatMicroAlgos, type LiveNetworkId } from '@initlabs/vibekit/views'
import type algosdk from 'algosdk'

import { clientsFor } from '../app/api/explorer/clients'

export type { LiveNetworkId }

// --- URL shape ---

const NETWORK_NAMES = ['mainnet', 'testnet', 'localnet'] as const

/** `/<entity>/<key>` is mainnet; `/<entity>/<network>/<key>` names the network. */
export function parseEntityRef(
  ref: string[] | undefined,
): { network: LiveNetworkId; key: string } | undefined {
  if (!ref || ref.length === 0 || ref.length > 2) return undefined
  if (ref.length === 1)
    return ref[0] && !(NETWORK_NAMES as readonly string[]).includes(ref[0])
      ? { network: 'mainnet', key: ref[0] }
      : undefined
  const [network, key] = ref
  return (NETWORK_NAMES as readonly string[]).includes(network!) && key
    ? { network: network as LiveNetworkId, key }
    : undefined
}

// --- Cache policy: the graceful part of the fallback ---

/** Confirmed via indexer: final data from the durable source. */
const FOREVER = 'public, max-age=31536000, immutable'
/** Confirmed via algod's pending pool: final data, but let future crawls graduate to the indexer render. */
const ALGOD_CONFIRMED = 'public, s-maxage=600, stale-while-revalidate=600'
/** Live entity state (assets, applications) — can change under the same URL. */
const MUTABLE = 'public, s-maxage=300, stale-while-revalidate=3600'
/** In the pool, not yet confirmed: never let a placeholder stick. */
const PENDING = 'public, s-maxage=10'
/** Nothing found: short-lived so a late-indexed entity recovers. */
const MISSING = 'public, s-maxage=60'

export type Resolution<T> =
  | { state: 'found'; card: T; cacheControl: string }
  | { state: 'pending'; cacheControl: string }
  | { state: 'missing'; cacheControl: string }

// --- Card models: exactly what the card and page display ---

export interface TxnCard {
  kind: 'transaction'
  network: LiveNetworkId
  id: string
  typeLabel: string
  /** Formatted with unit, e.g. "12.5 ALGO" or "100 USDC"; absent for app calls etc. */
  amount?: string
  sender: string
  /** Counterparty: an address, or "APP 123" / "ASA 123" for calls and configs. */
  to?: string
  fee: string
  round?: number
  time?: string
  /** "ASA 123" / "APP 123" when the transaction created something. */
  created?: string
}

export interface AssetCard {
  kind: 'asset'
  network: LiveNetworkId
  id: number
  name: string
  unitName?: string
  total: string
  decimals: number
  creator: string
  url?: string
}

export interface AppCard {
  kind: 'application'
  network: LiveNetworkId
  id: number
  creator: string
  globalStateCount: number
  globalUints: number
  globalBytes: number
  extraPages: number
}

export interface BlockCard {
  kind: 'block'
  network: LiveNetworkId
  round: number
  time: string
  txnCount: number
  proposer?: string
}

export type EntityCardModel = TxnCard | AssetCard | AppCard | BlockCard

// --- Shared plumbing ---

const is404 = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  (error as { status?: unknown }).status === 404

export const TXN_TYPE_LABELS: Record<string, string> = {
  pay: 'PAYMENT',
  axfer: 'ASSET TRANSFER',
  appl: 'APP CALL',
  acfg: 'ASSET CONFIG',
  afrz: 'ASSET FREEZE',
  keyreg: 'KEY REGISTRATION',
  stpf: 'STATE PROOF',
  hb: 'HEARTBEAT',
}

export function txnTypeLabel(type: string): string {
  return TXN_TYPE_LABELS[type] ?? type.toUpperCase()
}

export function timeLabel(unixSeconds: number): string {
  return `${new Date(unixSeconds * 1000).toISOString().replace('T', ' ').slice(0, 16)} UTC`
}

/** "1,234.56 USDC" — unit and decimals from algod; a plain unit count if the asset lookup fails. */
async function assetAmount(
  algod: algosdk.Algodv2,
  assetId: bigint,
  amount: bigint,
): Promise<string> {
  try {
    const asset = await algod.getAssetByID(assetId).do()
    const unit = asset.params?.unitName ?? asset.params?.name ?? `ASA ${assetId}`
    return `${formatBaseUnits(amount.toString(), Number(asset.params?.decimals ?? 0))} ${unit}`
  } catch {
    return `${amount} × ASA ${assetId}`
  }
}

const algo = (micro: bigint | number): string => `${formatMicroAlgos(micro.toString())} ALGO`

// --- Transactions: indexer first, algod pending pool as the rescue ---

type IndexerTxn = Awaited<
  ReturnType<ReturnType<algosdk.Indexer['lookupTransactionByID']>['do']>
>['transaction']

async function fromIndexerTxn(
  network: LiveNetworkId,
  algod: algosdk.Algodv2,
  txid: string,
  t: IndexerTxn,
): Promise<TxnCard> {
  const card: TxnCard = {
    kind: 'transaction',
    network,
    id: t.id ?? txid,
    typeLabel: txnTypeLabel(t.txType ?? ''),
    sender: t.sender,
    fee: algo(t.fee),
    round: t.confirmedRound === undefined ? undefined : Number(t.confirmedRound),
    time: t.roundTime === undefined ? undefined : timeLabel(t.roundTime),
  }
  if (t.paymentTransaction) {
    card.amount = algo(t.paymentTransaction.amount)
    card.to = t.paymentTransaction.receiver
  } else if (t.assetTransferTransaction) {
    const { assetId, amount, receiver } = t.assetTransferTransaction
    card.amount = await assetAmount(algod, assetId, amount)
    card.to = receiver
  } else if (t.applicationTransaction?.applicationId) {
    card.to = `APP ${t.applicationTransaction.applicationId}`
  } else if (t.assetConfigTransaction?.assetId) {
    card.to = `ASA ${t.assetConfigTransaction.assetId}`
  }
  if (t.createdAssetIndex) card.created = `ASA ${t.createdAssetIndex}`
  if (t.createdApplicationIndex) card.created = `APP ${t.createdApplicationIndex}`
  return card
}

async function fromPendingTxn(
  network: LiveNetworkId,
  algod: algosdk.Algodv2,
  txid: string,
  pending: { confirmedRound?: bigint; assetIndex?: bigint; applicationIndex?: bigint },
  txn: algosdk.Transaction,
): Promise<TxnCard> {
  const card: TxnCard = {
    kind: 'transaction',
    network,
    id: txid,
    typeLabel: txnTypeLabel(txn.type ?? ''),
    sender: txn.sender.toString(),
    fee: algo(txn.fee),
    round: pending.confirmedRound === undefined ? undefined : Number(pending.confirmedRound),
    // The pending response carries no block time; the indexer render fills it in later.
  }
  if (txn.payment) {
    card.amount = algo(txn.payment.amount)
    card.to = txn.payment.receiver.toString()
  } else if (txn.assetTransfer) {
    card.amount = await assetAmount(algod, txn.assetTransfer.assetIndex, txn.assetTransfer.amount)
    card.to = txn.assetTransfer.receiver.toString()
  } else if (txn.applicationCall?.appIndex) {
    card.to = `APP ${txn.applicationCall.appIndex}`
  }
  if (pending.assetIndex) card.created = `ASA ${pending.assetIndex}`
  if (pending.applicationIndex) card.created = `APP ${pending.applicationIndex}`
  return card
}

export async function resolveTransaction(
  network: LiveNetworkId,
  txid: string,
): Promise<Resolution<TxnCard>> {
  const { algod, indexer } = clientsFor(network)
  try {
    const response = await indexer.lookupTransactionByID(txid).do()
    const card = await fromIndexerTxn(network, algod, txid, response.transaction)
    return { state: 'found', card, cacheControl: FOREVER }
  } catch (error) {
    if (!is404(error)) throw error
  }
  try {
    const pending = await algod.pendingTransactionInformation(txid).do()
    if (pending.confirmedRound && pending.confirmedRound > 0) {
      const card = await fromPendingTxn(network, algod, txid, pending, pending.txn.txn)
      return { state: 'found', card, cacheControl: ALGOD_CONFIRMED }
    }
    if (!pending.poolError) return { state: 'pending', cacheControl: PENDING }
  } catch (error) {
    if (!is404(error)) throw error
  }
  return { state: 'missing', cacheControl: MISSING }
}

// --- Assets, applications, blocks: algod state, durable for the entity's lifetime ---

export async function resolveAsset(
  network: LiveNetworkId,
  id: number,
): Promise<Resolution<AssetCard>> {
  const { algod } = clientsFor(network)
  try {
    const asset = await algod.getAssetByID(id).do()
    const { params } = asset
    if (!params) return { state: 'missing', cacheControl: MISSING }
    return {
      state: 'found',
      cacheControl: MUTABLE,
      card: {
        kind: 'asset',
        network,
        id,
        name: params.name ?? `ASA ${id}`,
        unitName: params.unitName,
        total: formatBaseUnits(params.total.toString(), Number(params.decimals)),
        decimals: Number(params.decimals),
        creator: params.creator,
        url: params.url,
      },
    }
  } catch (error) {
    if (!is404(error)) throw error
    return { state: 'missing', cacheControl: MISSING }
  }
}

export async function resolveApplication(
  network: LiveNetworkId,
  id: number,
): Promise<Resolution<AppCard>> {
  const { algod } = clientsFor(network)
  try {
    const app = await algod.getApplicationByID(id).do()
    const { params } = app
    if (!params) return { state: 'missing', cacheControl: MISSING }
    return {
      state: 'found',
      cacheControl: MUTABLE,
      card: {
        kind: 'application',
        network,
        id,
        creator: String(params.creator),
        globalStateCount: params.globalState?.length ?? 0,
        globalUints: Number(params.globalStateSchema?.numUint ?? 0),
        globalBytes: Number(params.globalStateSchema?.numByteSlice ?? 0),
        extraPages: Number(params.extraProgramPages ?? 0),
      },
    }
  } catch (error) {
    if (!is404(error)) throw error
    return { state: 'missing', cacheControl: MISSING }
  }
}

export async function resolveBlock(
  network: LiveNetworkId,
  round: number,
): Promise<Resolution<BlockCard>> {
  const { algod } = clientsFor(network)
  try {
    const response = await algod.block(round).do()
    const header = response.block.header
    return {
      state: 'found',
      cacheControl: FOREVER,
      card: {
        kind: 'block',
        network,
        round: Number(header.round),
        time: timeLabel(Number(header.timestamp)),
        txnCount: response.block.payset?.length ?? 0,
        proposer: header.proposer ? String(header.proposer) : undefined,
      },
    }
  } catch (error) {
    // A future round isn't an error worth caching — it exists in seconds.
    if (!is404(error)) throw error
    return { state: 'missing', cacheControl: MISSING }
  }
}

// --- Key-based wrappers: URL segment in, resolution out. ---
// A malformed key is a miss without a network call; react's cache() dedupes
// the generateMetadata + page pair inside one request.

const INVALID: Resolution<never> = { state: 'missing', cacheControl: MISSING }
const TXID = /^[A-Z2-7]{52}$/
const NUMERIC_ID = /^\d{1,15}$/

export const resolveTransactionByKey = cache(
  async (network: LiveNetworkId, key: string): Promise<Resolution<TxnCard>> =>
    TXID.test(key) ? resolveTransaction(network, key) : INVALID,
)

export const resolveAssetByKey = cache(
  async (network: LiveNetworkId, key: string): Promise<Resolution<AssetCard>> =>
    NUMERIC_ID.test(key) ? resolveAsset(network, Number(key)) : INVALID,
)

export const resolveApplicationByKey = cache(
  async (network: LiveNetworkId, key: string): Promise<Resolution<AppCard>> =>
    NUMERIC_ID.test(key) ? resolveApplication(network, Number(key)) : INVALID,
)

export const resolveBlockByKey = cache(
  async (network: LiveNetworkId, key: string): Promise<Resolution<BlockCard>> =>
    NUMERIC_ID.test(key) ? resolveBlock(network, Number(key)) : INVALID,
)
