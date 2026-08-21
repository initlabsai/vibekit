import type { FormattedTransaction } from '@initlabs/vibekit-tools'
import { z } from 'zod'

import { uint64JsonSchema } from '../core/algo.js'

/**
 * Renderer-independent flow graph for a transaction group: one vertical
 * (column) per distinct entity, one horizontal (row) per transaction in
 * depth-first group order. Ports algokit-lora's transactions-graph mappers
 * (src/features/transactions-graph/mappers) onto our wire shape.
 *
 * Wire-driven deviations from Lora, each documented at the site that makes it:
 * - Application escrow addresses come from the injected
 *   {@link BuildTransactionsGraphOptions.appAddressFor} — this module stays
 *   browser-safe and never imports algosdk.
 * - The op-up test approximates Lora's program-bytes match with the
 *   observable transaction shape (see {@link isOpUp}).
 * - Lora's trailing Placeholder vertical (spacing for a self-loop on the last
 *   column) is a rendering concern and is not emitted here.
 */

/** One wire transaction: a transaction.detail record or a transaction.group row. */
export type GraphTransaction = FormattedTransaction

const accountNumberSchema = z.number().int().positive()
const verticalIndexSchema = z.number().int().nonnegative()

/** Endpoint tag naming which identity acted: an accountNumber, or 'rekey'. */
export const graphMarkerTagSchema = z.union([accountNumberSchema, z.literal('rekey')])

/** A rekey or clawback identity attached to a vertical. */
export const graphAssociatedAccountSchema = z
  .object({
    kind: z.enum(['rekey', 'clawback']),
    address: z.string().min(1),
    accountNumber: accountNumberSchema,
  })
  .strict()

/** One column of the graph: account, application, asset, or merged op-up. */
export const graphVerticalSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('account'),
      address: z.string().min(1),
      accountNumber: accountNumberSchema,
      associatedAccounts: z.array(graphAssociatedAccountSchema),
    })
    .strict(),
  z
    .object({
      type: z.literal('application'),
      applicationId: z.number().int().nonnegative(),
      // Absent when the host injects no appAddressFor (escrow unknown).
      linkedAccount: z
        .object({ address: z.string().min(1), accountNumber: accountNumberSchema })
        .strict()
        .optional(),
      associatedAccounts: z.array(graphAssociatedAccountSchema),
    })
    .strict(),
  z.object({ type: z.literal('asset'), assetId: z.number().int().nonnegative() }).strict(),
  z.object({ type: z.literal('opUp') }).strict(),
])

export const graphLabelTypeSchema = z.enum([
  'payment',
  'paymentRemainder',
  'assetTransfer',
  'assetTransferRemainder',
  'clawback',
  'appCall',
  'appCreate',
  'appUpdate',
  'assetCreate',
  'assetReconfigure',
  'assetDestroy',
  'assetFreeze',
  'keyReg',
  'stateProof',
  'heartbeat',
])

/** Row caption: kind plus the display amount for value-moving rows. */
export const graphLabelSchema = z
  .object({
    type: graphLabelTypeSchema,
    amountMicroAlgos: uint64JsonSchema.optional(),
    assetAmount: uint64JsonSchema.optional(),
    assetId: z.number().int().nonnegative().optional(),
    assetDecimals: z.number().int().nonnegative().optional(),
    assetUnitName: z.string().min(1).optional(),
    // Filled from the transaction's methodName or methodNameFor (My Apps spec).
    methodName: z.string().min(1).optional(),
  })
  .strict()

/**
 * How a row is drawn. Vector indexes are normalized (fromVertical <
 * toVertical) with `direction` giving the flow; fromTag stays the sender-side
 * tag and toTag the receiver-side tag regardless of normalization, exactly as
 * Lora renders them.
 */
export const graphRepresentationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('vector'),
      fromVertical: verticalIndexSchema,
      toVertical: verticalIndexSchema,
      direction: z.enum(['leftToRight', 'rightToLeft']),
      fromTag: graphMarkerTagSchema.optional(),
      toTag: graphMarkerTagSchema.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('selfLoop'),
      vertical: verticalIndexSchema,
      fromTag: graphMarkerTagSchema.optional(),
      toTag: graphMarkerTagSchema.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('point'),
      vertical: verticalIndexSchema,
      fromTag: graphMarkerTagSchema.optional(),
    })
    .strict(),
])

/** One row: a transaction, or the close-out remainder sub-row of one. */
export const graphHorizontalSchema = z
  .object({
    representation: graphRepresentationSchema,
    label: graphLabelSchema,
    depth: z.number().int().nonnegative(),
    // Row indexes (into horizontals) of the app-call ancestor chain, outermost first.
    ancestors: z.array(z.number().int().nonnegative()),
    isRemainder: z.boolean(),
    hasNextSibling: z.boolean(),
    // Absent on inner transactions — the indexer assigns them no id.
    transactionId: z.string().min(1).optional(),
  })
  .strict()

/** Derived presentation data for the transaction-group flow graph. */
export const transactionsGraphSchema = z
  .object({
    verticals: z.array(graphVerticalSchema),
    horizontals: z.array(graphHorizontalSchema),
  })
  .strict()

export type GraphMarkerTag = z.infer<typeof graphMarkerTagSchema>
export type GraphAssociatedAccount = z.infer<typeof graphAssociatedAccountSchema>
export type GraphVertical = z.infer<typeof graphVerticalSchema>
export type GraphLabelType = z.infer<typeof graphLabelTypeSchema>
export type GraphLabel = z.infer<typeof graphLabelSchema>
export type GraphRepresentation = z.infer<typeof graphRepresentationSchema>
export type GraphHorizontal = z.infer<typeof graphHorizontalSchema>
export type TransactionsGraph = z.infer<typeof transactionsGraphSchema>

export interface BuildTransactionsGraphOptions {
  /**
   * Computes an application's escrow address (the host passes algosdk's
   * getApplicationAddress; tests pass a recorded map). Without it, escrow
   * accounts keep their own columns instead of merging into their
   * application's vertical, and inner senders are not tagged as rekeys.
   */
  appAddressFor?: (applicationId: number) => string
  /**
   * ABI method name for an application call. Hosts that have a My Apps spec
   * for the application fill this; the transaction may already carry
   * `methodName` from earlier enrichment.
   */
  methodNameFor?: (txn: GraphTransaction) => string | undefined
}

interface MutableAssociated {
  kind: 'rekey' | 'clawback'
  address: string
  accountNumber: number
}

type MutableVertical =
  | { type: 'account'; address: string; accountNumber: number; associatedAccounts: MutableAssociated[] }
  | {
      type: 'application'
      applicationId: number
      linkedAccount?: { address: string; accountNumber: number }
      associatedAccounts: MutableAssociated[]
    }
  | { type: 'asset'; assetId: number }
  | { type: 'opUp' }

interface FromTo {
  vertical: number
  tag?: GraphMarkerTag
}

interface RowSeed {
  representation: GraphRepresentation
  label: GraphLabel
}

function flattenTransactions(transactions: readonly GraphTransaction[]): GraphTransaction[] {
  return transactions.flatMap((txn) => [txn, ...flattenTransactions(txn.innerTxns ?? [])])
}

function isClawback(txn: GraphTransaction): boolean {
  return txn.type === 'axfer' && txn.clawbackFrom !== undefined
}

/** The application an appl row acts on: the target id, or the created id on creates. */
function effectiveApplicationId(txn: GraphTransaction): number {
  const applicationId = txn.applicationId ?? 0
  return applicationId === 0 ? (txn.createdApplicationId ?? 0) : applicationId
}

/**
 * The asset an acfg row acts on: the configured id, or the created id on
 * creates. Undefined on a create whose wire predates createdAssetId (or a
 * pending one), where no asset column can be drawn.
 */
function effectiveAssetId(txn: GraphTransaction): number | undefined {
  if (txn.assetId === undefined || txn.assetId === 0) return txn.createdAssetId
  return txn.assetId
}

/** An outer transaction signed by another key (auth-addr) acts through a rekeyed sender. */
function hasRekeyedSigner(txn: GraphTransaction): boolean {
  return txn.signer !== undefined && txn.signer !== txn.sender
}

function isEmptyDelta(delta: unknown): boolean {
  return delta == null || (Array.isArray(delta) && delta.length === 0)
}

/**
 * Lora flags op-ups by matching the app's approval/clear programs against
 * known op-up program bytes; the wire omits programs and app args, so
 * approximate with the observable shape: an app create + delete producing no
 * inner effects. A do-nothing create + delete that is not an op-up would be
 * merged into the op-up column by this approximation.
 */
function isOpUp(txn: GraphTransaction): boolean {
  return (
    txn.type === 'appl' &&
    (txn.applicationId ?? 0) === 0 &&
    txn.onCompletion === 'delete' &&
    (txn.innerTxns ?? []).length === 0 &&
    (txn.logs ?? []).length === 0 &&
    isEmptyDelta(txn.globalStateDelta) &&
    isEmptyDelta(txn.localStateDelta)
  )
}

function distinctByAddress(accounts: MutableAssociated[]): MutableAssociated[] {
  const seen = new Set<string>()
  return accounts.filter((account) => {
    if (seen.has(account.address)) return false
    seen.add(account.address)
    return true
  })
}

function accountVertical(address: string, associatedAccounts: MutableAssociated[] = []): MutableVertical {
  return { type: 'account', address, accountNumber: -1, associatedAccounts }
}

function rawVerticalsForTransaction(
  txn: GraphTransaction,
  appAddressFor: BuildTransactionsGraphOptions['appAddressFor'],
): MutableVertical[] {
  const verticals: MutableVertical[] = [
    accountVertical(
      txn.sender,
      isClawback(txn) && txn.clawbackFrom !== undefined
        ? [{ kind: 'clawback', address: txn.clawbackFrom, accountNumber: -1 }]
        : [],
    ),
  ]
  if (txn.type === 'pay' || txn.type === 'axfer') {
    if (txn.receiver !== undefined) verticals.push(accountVertical(txn.receiver))
    if (txn.closeTo !== undefined) verticals.push(accountVertical(txn.closeTo))
  }
  if (txn.type === 'appl') {
    if (isOpUp(txn)) {
      verticals.push({ type: 'opUp' })
    } else {
      // Creates resolve to the indexer's created id; a pending create (no
      // createdApplicationId yet) falls back to a column for application 0.
      const applicationId = effectiveApplicationId(txn)
      const escrow = applicationId === 0 ? undefined : appAddressFor?.(applicationId)
      const associatedAccounts: MutableAssociated[] = []
      for (const inner of txn.innerTxns ?? []) {
        if (escrow !== undefined && inner.sender !== escrow) {
          associatedAccounts.push({ kind: 'rekey', address: inner.sender, accountNumber: -1 })
        }
        if (isClawback(inner) && inner.clawbackFrom !== undefined) {
          associatedAccounts.push({ kind: 'clawback', address: inner.clawbackFrom, accountNumber: -1 })
        }
      }
      verticals.push({
        type: 'application',
        applicationId,
        ...(escrow === undefined ? {} : { linkedAccount: { address: escrow, accountNumber: -1 } }),
        associatedAccounts: distinctByAddress(associatedAccounts),
      })
    }
  }
  if (txn.type === 'acfg') {
    const assetId = effectiveAssetId(txn)
    if (assetId !== undefined) verticals.push({ type: 'asset', assetId })
  }
  if (txn.type === 'afrz' && txn.freezeTarget !== undefined) {
    verticals.push(accountVertical(txn.freezeTarget))
  }
  return verticals
}

function mergeRawVerticals(raw: MutableVertical[]): MutableVertical[] {
  return raw.reduce<MutableVertical[]>((acc, current) => {
    if (current.type === 'account') {
      const present = acc.some(
        (v) =>
          (v.type === 'account' && v.address === current.address) ||
          // An application has its own account too.
          (v.type === 'application' && v.linkedAccount?.address === current.address),
      )
      if (present) return acc
      const app = raw.find((v) => v.type === 'application' && v.linkedAccount?.address === current.address)
      if (app) return [...acc, app]
      // Prefer the richer entry when this account has associated identities elsewhere.
      const withAssociated = raw.find(
        (v) => v.type === 'account' && v.address === current.address && v.associatedAccounts.length > 0,
      )
      if (withAssociated) return [...acc, withAssociated]
      return [...acc, current]
    }
    if (current.type === 'application') {
      const index = acc.findIndex((v) => v.type === 'application' && v.applicationId === current.applicationId)
      if (index === -1) return [...acc, current]
      // One application can act for several accounts; union them into one column.
      const existing = acc[index] as Extract<MutableVertical, { type: 'application' }>
      const linkedAccount = current.linkedAccount ?? existing.linkedAccount
      acc.splice(index, 1, {
        type: 'application',
        applicationId: current.applicationId,
        ...(linkedAccount === undefined ? {} : { linkedAccount }),
        associatedAccounts: distinctByAddress([...existing.associatedAccounts, ...current.associatedAccounts]),
      })
      return acc
    }
    if (current.type === 'asset') {
      if (acc.some((v) => v.type === 'asset' && v.assetId === current.assetId)) return acc
      return [...acc, current]
    }
    if (acc.some((v) => v.type === 'opUp')) return acc
    return [...acc, current]
  }, [])
}

/** Assigns 1-based accountNumbers over all unique addresses in column order. */
function numberVerticals(verticals: MutableVertical[]): MutableVertical[] {
  const addresses: string[] = []
  const claim = (address: string) => {
    if (!addresses.includes(address)) addresses.push(address)
    return addresses.indexOf(address) + 1
  }
  for (const vertical of verticals) {
    if (vertical.type === 'account') {
      vertical.accountNumber = claim(vertical.address)
      for (const account of vertical.associatedAccounts) account.accountNumber = claim(account.address)
    }
    if (vertical.type === 'application') {
      if (vertical.linkedAccount) vertical.linkedAccount.accountNumber = claim(vertical.linkedAccount.address)
      for (const account of vertical.associatedAccounts) account.accountNumber = claim(account.address)
    }
  }
  return verticals
}

function markerTag(account: MutableAssociated): GraphMarkerTag {
  return account.kind === 'rekey' ? 'rekey' : account.accountNumber
}

function findAccount(verticals: MutableVertical[], address: string) {
  const index = verticals.findIndex((v) => v.type === 'account' && v.address === address)
  return index === -1
    ? undefined
    : { index, vertical: verticals[index] as Extract<MutableVertical, { type: 'account' }> }
}

function findApplicationByEscrow(verticals: MutableVertical[], address: string) {
  const index = verticals.findIndex((v) => v.type === 'application' && v.linkedAccount?.address === address)
  return index === -1
    ? undefined
    : { index, vertical: verticals[index] as Extract<MutableVertical, { type: 'application' }> }
}

function fromWithoutParent(verticals: MutableVertical[], sender: string, tagAddress?: string): FromTo {
  const account = findAccount(verticals, sender)
  if (account) {
    const tagged = tagAddress
      ? (findAccount(verticals, tagAddress)?.vertical.associatedAccounts.find((a) => a.address === sender) ??
        account.vertical.associatedAccounts.find((a) => a.address === tagAddress))
      : undefined
    const tag = tagged
      ? markerTag(tagged)
      : sender === account.vertical.address
        ? account.vertical.accountNumber
        : account.vertical.associatedAccounts.find((a) => a.address === sender)?.accountNumber
    return { vertical: account.index, ...(tag === undefined ? {} : { tag }) }
  }
  const application = findApplicationByEscrow(verticals, sender)
  if (application) {
    const tagged = tagAddress
      ? findAccount(verticals, tagAddress)?.vertical.associatedAccounts.find((a) => a.address === sender)
      : undefined
    const tag = tagged ? markerTag(tagged) : application.vertical.linkedAccount?.accountNumber
    return { vertical: application.index, ...(tag === undefined ? {} : { tag }) }
  }
  throw new Error(`Transaction graph: no vertical for sender ${sender}`)
}

function fromWithParent(
  verticals: MutableVertical[],
  sender: string,
  parentApplicationId: number,
  tagAddress?: string,
): FromTo {
  const parentIndex = verticals.findIndex(
    (v) => v.type === 'application' && v.applicationId === parentApplicationId,
  )
  if (parentIndex === -1) return fromWithoutParent(verticals, sender, tagAddress)
  const parent = verticals[parentIndex] as Extract<MutableVertical, { type: 'application' }>

  if (tagAddress !== undefined) {
    const accountNumber = parent.associatedAccounts.find((a) => a.address === tagAddress)?.accountNumber
    if (accountNumber !== undefined) return { vertical: parentIndex, tag: accountNumber }
  }
  if (parent.linkedAccount && sender === parent.linkedAccount.address) {
    return { vertical: parentIndex, tag: parent.linkedAccount.accountNumber }
  }
  const isRekeyed = parent.associatedAccounts.some((a) => a.kind === 'rekey' && a.address === sender)
  const account = findAccount(verticals, sender)
  if (account) {
    return { vertical: account.index, tag: isRekeyed ? 'rekey' : account.vertical.accountNumber }
  }
  const application = findApplicationByEscrow(verticals, sender)
  if (application) {
    const tag = isRekeyed ? 'rekey' : application.vertical.linkedAccount?.accountNumber
    return { vertical: application.index, ...(tag === undefined ? {} : { tag }) }
  }
  throw new Error(`Transaction graph: no vertical for inner sender ${sender}`)
}

/** Receiver endpoint: the application column wins when the address is an escrow. */
function toAccountOrApplication(verticals: MutableVertical[], address: string): FromTo {
  const application = findApplicationByEscrow(verticals, address)
  if (application?.vertical.linkedAccount) {
    return { vertical: application.index, tag: application.vertical.linkedAccount.accountNumber }
  }
  const account = findAccount(verticals, address)
  if (account) return { vertical: account.index, tag: account.vertical.accountNumber }
  throw new Error(`Transaction graph: no vertical for receiver ${address}`)
}

function asRepresentation(from: FromTo, to: FromTo): GraphRepresentation {
  if (from.vertical === to.vertical) {
    return {
      kind: 'selfLoop',
      vertical: from.vertical,
      ...(from.tag === undefined ? {} : { fromTag: from.tag }),
      ...(to.tag === undefined ? {} : { toTag: to.tag }),
    }
  }
  return {
    kind: 'vector',
    fromVertical: Math.min(from.vertical, to.vertical),
    toVertical: Math.max(from.vertical, to.vertical),
    direction: from.vertical < to.vertical ? 'leftToRight' : 'rightToLeft',
    ...(from.tag === undefined ? {} : { fromTag: from.tag }),
    ...(to.tag === undefined ? {} : { toTag: to.tag }),
  }
}

function asPoint(from: FromTo, label: GraphLabel): RowSeed {
  return {
    representation: {
      kind: 'point',
      vertical: from.vertical,
      ...(from.tag === undefined ? {} : { fromTag: from.tag }),
    },
    label,
  }
}

function assetLabelFields(txn: GraphTransaction): Partial<GraphLabel> {
  return {
    ...(txn.assetId === undefined ? {} : { assetId: txn.assetId }),
    ...(txn.assetDecimals === undefined ? {} : { assetDecimals: txn.assetDecimals }),
    ...(txn.assetUnitName === undefined ? {} : { assetUnitName: txn.assetUnitName }),
  }
}

function representationsFor(
  verticals: MutableVertical[],
  txn: GraphTransaction,
  parent: GraphTransaction | undefined,
  methodNameFor?: (txn: GraphTransaction) => string | undefined,
): RowSeed[] {
  const senderFrom = (tagAddress?: string): FromTo => {
    if (parent) return fromWithParent(verticals, txn.sender, effectiveApplicationId(parent), tagAddress)
    const from = fromWithoutParent(verticals, txn.sender, tagAddress)
    // Rekey-tag the sender endpoint when another key signed the outer
    // transaction, unless a clawback tag already claims it.
    return tagAddress === undefined && hasRekeyedSigner(txn) ? { ...from, tag: 'rekey' } : from
  }

  switch (txn.type) {
    case 'pay': {
      const rows: RowSeed[] = [
        {
          representation: asRepresentation(
            senderFrom(),
            toAccountOrApplication(verticals, txn.receiver ?? txn.sender),
          ),
          label: { type: 'payment', amountMicroAlgos: txn.paymentAmountMicroAlgos ?? 0 },
        },
      ]
      if (txn.closeTo !== undefined) {
        rows.push({
          representation: asRepresentation(
            fromWithoutParent(verticals, txn.sender),
            toAccountOrApplication(verticals, txn.closeTo),
          ),
          label: { type: 'paymentRemainder', amountMicroAlgos: txn.closeAmountMicroAlgos ?? 0 },
        })
      }
      return rows
    }
    case 'axfer': {
      const clawback = isClawback(txn)
      const rows: RowSeed[] = [
        {
          representation: asRepresentation(
            senderFrom(clawback ? txn.clawbackFrom : undefined),
            toAccountOrApplication(verticals, txn.receiver ?? txn.sender),
          ),
          label: {
            type: clawback ? 'clawback' : 'assetTransfer',
            assetAmount: txn.assetAmount ?? 0,
            ...assetLabelFields(txn),
          },
        },
      ]
      if (txn.closeTo !== undefined) {
        rows.push({
          representation: asRepresentation(
            fromWithoutParent(verticals, txn.sender),
            toAccountOrApplication(verticals, txn.closeTo),
          ),
          label: {
            type: 'assetTransferRemainder',
            assetAmount: txn.closeAssetAmount ?? 0,
            ...assetLabelFields(txn),
          },
        })
      }
      return rows
    }
    case 'appl': {
      const to = isOpUp(txn)
        ? verticals.findIndex((v) => v.type === 'opUp')
        : verticals.findIndex((v) => v.type === 'application' && v.applicationId === effectiveApplicationId(txn))
      const type =
        (txn.applicationId ?? 0) === 0 ? 'appCreate' : txn.onCompletion === 'update' ? 'appUpdate' : 'appCall'
      const methodName = txn.methodName ?? methodNameFor?.(txn)
      return [
        {
          representation: asRepresentation(senderFrom(), { vertical: to }),
          label: { type, ...(methodName ? { methodName } : {}) },
        },
      ]
    }
    case 'acfg': {
      // assetId 0 creates; params present reconfigures; params absent destroys.
      const label: GraphLabel = {
        type:
          (txn.assetId ?? 0) === 0
            ? 'assetCreate'
            : txn.assetConfig !== undefined
              ? 'assetReconfigure'
              : 'assetDestroy',
      }
      const assetId = effectiveAssetId(txn)
      // A create whose wire carries no createdAssetId has no asset column to point at.
      if (assetId === undefined) return [asPoint(senderFrom(), label)]
      const to = verticals.findIndex((v) => v.type === 'asset' && v.assetId === assetId)
      return [{ representation: asRepresentation(senderFrom(), { vertical: to }), label }]
    }
    case 'afrz': {
      const label: GraphLabel = { type: 'assetFreeze', ...assetLabelFields(txn) }
      // A freeze whose wire predates freezeTarget degrades to a point at the sender.
      if (txn.freezeTarget === undefined) return [asPoint(senderFrom(), label)]
      return [
        {
          representation: asRepresentation(senderFrom(), toAccountOrApplication(verticals, txn.freezeTarget)),
          label,
        },
      ]
    }
    case 'keyreg':
      return [asPoint(senderFrom(), { type: 'keyReg' })]
    case 'stpf':
      return [asPoint(fromWithoutParent(verticals, txn.sender), { type: 'stateProof' })]
    case 'hb':
      return [asPoint(fromWithoutParent(verticals, txn.sender), { type: 'heartbeat' })]
    default:
      throw new Error(`Transaction graph: unsupported transaction type "${txn.type ?? '(none)'}"`)
  }
}

function appendRows(
  verticals: MutableVertical[],
  horizontals: GraphHorizontal[],
  txn: GraphTransaction,
  parent: GraphTransaction | undefined,
  ancestors: number[],
  hasNextSibling: boolean,
  depth: number,
  methodNameFor?: (txn: GraphTransaction) => string | undefined,
): void {
  const seeds = representationsFor(verticals, txn, parent, methodNameFor)
  const rowIndex = horizontals.length
  seeds.forEach((seed, index) => {
    horizontals.push({
      representation: seed.representation,
      label: seed.label,
      depth,
      ancestors,
      isRemainder: index > 0,
      hasNextSibling,
      ...(txn.id === undefined ? {} : { transactionId: txn.id }),
    })
  })
  if (txn.type !== 'appl') return
  const inners = txn.innerTxns ?? []
  inners.forEach((inner, index) => {
    appendRows(
      verticals,
      horizontals,
      inner,
      txn,
      [...ancestors, rowIndex],
      index < inners.length - 1,
      depth + 1,
      methodNameFor,
    )
  })
}

/**
 * Builds the flow graph for the transactions of one group (or one transaction
 * with its inners). Pure and synchronous; entity columns appear in
 * first-appearance order over the transactions traversed depth-first.
 */
export function buildTransactionsGraph(
  transactions: readonly GraphTransaction[],
  options: BuildTransactionsGraphOptions = {},
): TransactionsGraph {
  const flattened = flattenTransactions(transactions)
  const verticals = numberVerticals(
    mergeRawVerticals(flattened.flatMap((txn) => rawVerticalsForTransaction(txn, options.appAddressFor))),
  )
  const horizontals: GraphHorizontal[] = []
  for (const txn of transactions) {
    appendRows(verticals, horizontals, txn, undefined, [], false, 0, options.methodNameFor)
  }
  return transactionsGraphSchema.parse({ verticals, horizontals })
}
