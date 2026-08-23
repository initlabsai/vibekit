import {
  buildTransactionsGraph,
  formatBaseUnits,
  formatMicroAlgos,
  type GraphHorizontal,
  type GraphLabel,
  type GraphMarkerTag,
  type GraphTransaction,
  type GraphVertical,
  type TransactionsGraph,
} from '@initlabs/vibekit-explorer'
import { getApplicationAddress } from 'algosdk'

import { COLORS, shorten } from '../theme.js'

/**
 * Pure layout for the transaction flow-graph card: turns a TransactionsGraph
 * into colored line spans. Renders exactly what the model emits — verticals,
 * horizontals, representations, labels — and computes nothing of its own.
 */

/** One run of same-colored characters on a rendered line. */
export interface GraphSpan {
  text: string
  fg: string
}

/** One rendered line of the graph card. */
export type GraphLine = GraphSpan[]

/** Narrower lanes than this flip the card into the compact list form. */
export const MIN_LANE_WIDTH = 10

/** Lanes stop growing past this so few-column graphs stay tight. */
export const MAX_LANE_WIDTH = 26

export interface GraphLayout {
  /** 'lanes' draws swimlanes; 'compact' is the narrow-terminal list form. */
  mode: 'lanes' | 'compact'
  lines: GraphLine[]
  /** Lanes mode: x of each vertical's guide column. Empty in compact mode. */
  centers: number[]
  /** Index into `lines` of each horizontal's main content line. */
  rowLines: number[]
}

/** Joins a line's spans into plain text (for tests and width checks). */
export function lineText(line: GraphLine): string {
  return line.map((span) => span.text).join('')
}

const GUIDE = '│'
const NODE = '●'
const HEAD_RIGHT = '▶'
const HEAD_LEFT = '◀'
const LOOP = '⟲'
const DASH = '─'

interface Cell {
  ch: string
  fg: string
}

function newLine(width: number): Cell[] {
  return Array.from({ length: width }, () => ({ ch: ' ', fg: COLORS.text }))
}

function drawText(cells: Cell[], x: number, text: string, fg: string): void {
  for (let i = 0; i < text.length; i += 1) {
    const at = x + i
    if (at < 0 || at >= cells.length) continue
    cells[at] = { ch: text[i]!, fg }
  }
}

function drawSpans(cells: Cell[], x: number, spans: GraphSpan[]): void {
  let at = x
  for (const span of spans) {
    drawText(cells, at, span.text, span.fg)
    at += span.text.length
  }
}

function toSpans(cells: Cell[]): GraphLine {
  let end = cells.length
  while (end > 0 && cells[end - 1]!.ch === ' ') end -= 1
  const line: GraphLine = []
  for (let i = 0; i < end; i += 1) {
    const cell = cells[i]!
    const last = line[line.length - 1]
    // Spaces carry no visible color; fold them into the current run.
    if (last && (cell.ch === ' ' || last.fg === cell.fg)) last.text += cell.ch
    else line.push({ text: cell.ch, fg: cell.fg })
  }
  return line
}

function spansLength(spans: GraphSpan[]): number {
  return spans.reduce((sum, span) => sum + span.text.length, 0)
}

function clipSpans(spans: GraphSpan[], width: number): GraphSpan[] {
  const out: GraphSpan[] = []
  let used = 0
  for (const span of spans) {
    if (used >= width) break
    const room = width - used
    const text = span.text.length <= room ? span.text : `${span.text.slice(0, Math.max(0, room - 1))}…`
    out.push({ text, fg: span.fg })
    used += text.length
  }
  return out
}

/** Endpoint marker: `(n)` for an account number, `(rk)` for a rekeyed signer. */
export function markerText(tag: GraphMarkerTag | undefined): string {
  if (tag === undefined) return ''
  return tag === 'rekey' ? '(rk)' : `(${tag})`
}

/** Color family for a row label, from existing palette members only. */
export function labelColor(type: string): string {
  if (type.startsWith('payment') || type === 'rekey') return COLORS.brass
  if (type === 'clawback') return COLORS.brassBright
  if (type.startsWith('app')) return COLORS.brassBright
  if (type.startsWith('asset')) return COLORS.signal
  return COLORS.text
}

/**
 * Row caption segments: an optional dim kind word plus the display amount.
 * Unknown label types fall through generically as their type text.
 */
export function labelSegments(label: GraphLabel, isRemainder: boolean): GraphSpan[] {
  const color = labelColor(label.type)
  const segments: GraphSpan[] = []
  const remainder = isRemainder || label.type.endsWith('Remainder')
  if (remainder) {
    segments.push({ text: 'remainder', fg: COLORS.faint })
  } else if (label.type === 'assetOptIn') {
    segments.push({ text: 'opt-in', fg: color })
  } else if (label.type === 'rekey') {
    segments.push({ text: 'rekey', fg: color })
    return segments
  } else if (label.type !== 'payment' && label.type !== 'assetTransfer') {
    const method = label.methodName === undefined ? '' : ` ${label.methodName}`
    segments.push({ text: `${label.type}${method}`, fg: color })
  }
  let amount: string | undefined
  if (label.amountMicroAlgos !== undefined) {
    amount = `${formatMicroAlgos(label.amountMicroAlgos)} ALGO`
  } else if (label.assetAmount !== undefined) {
    const value =
      label.assetDecimals === undefined
        ? String(label.assetAmount)
        : formatBaseUnits(label.assetAmount, label.assetDecimals)
    const unit =
      label.assetUnitName ?? (label.assetId === undefined ? undefined : `asa ${label.assetId}`)
    // An opt-in moves nothing; the unit alone says which asset.
    amount = label.type === 'assetOptIn' ? unit : unit === undefined ? value : `${value} ${unit}`
  }
  if (amount !== undefined) {
    if (segments.length > 0) segments.push({ text: ' ', fg: color })
    segments.push({ text: amount, fg: color })
  }
  if (segments.length === 0) segments.push({ text: label.type, fg: color })
  return segments
}

/** Short entity name for compact rows and tests. */
export function verticalName(vertical: GraphVertical): string {
  switch (vertical.type) {
    case 'account':
      return `(${vertical.accountNumber}) ${shorten(vertical.address, 9)}`
    case 'application':
      return `app ${vertical.applicationId}${
        vertical.linkedAccount ? ` (${vertical.linkedAccount.accountNumber})` : ''
      }`
    case 'asset':
      return `asa ${vertical.assetId}`
    case 'opUp':
      return 'OpUp'
  }
}

function headingSpans(vertical: GraphVertical, avail: number): GraphSpan[] {
  switch (vertical.type) {
    case 'account': {
      const badge = `(${vertical.accountNumber}) `
      return [
        { text: badge, fg: COLORS.brass },
        { text: shorten(vertical.address, Math.max(4, avail - badge.length)), fg: COLORS.text },
      ]
    }
    case 'application': {
      const base = shorten(`app ${vertical.applicationId}`, avail)
      const spans: GraphSpan[] = [{ text: base, fg: COLORS.text }]
      if (vertical.linkedAccount) {
        const tag = ` (${vertical.linkedAccount.accountNumber})`
        if (base.length + tag.length <= avail) spans.push({ text: tag, fg: COLORS.brass })
      }
      return spans
    }
    case 'asset':
      return [{ text: shorten(`asa ${vertical.assetId}`, avail), fg: COLORS.text }]
    case 'opUp':
      return [{ text: 'OpUp', fg: COLORS.muted }]
  }
}

/** Tree-connector cells for one row's gutter; `main` is the arrow line. */
function drawTreePrefix(
  cells: Cell[],
  row: GraphHorizontal,
  horizontals: readonly GraphHorizontal[],
  main: boolean,
): void {
  if (row.depth === 0) return
  for (let level = 1; level < row.depth; level += 1) {
    const ancestor = horizontals[row.ancestors[level]!]
    if (ancestor?.hasNextSibling) drawText(cells, (level - 1) * 2, GUIDE, COLORS.faint)
  }
  const x = (row.depth - 1) * 2
  if (!main || row.isRemainder) {
    if (row.hasNextSibling) drawText(cells, x, GUIDE, COLORS.faint)
    return
  }
  drawText(cells, x, row.hasNextSibling ? '├─' : '└─', COLORS.faint)
}

function drawGuides(cells: Cell[], centers: readonly number[]): void {
  for (const center of centers) drawText(cells, center, GUIDE, COLORS.borderSoft)
}

function laneLayout(
  graph: TransactionsGraph,
  gutter: number,
  laneWidth: number,
  bodyWidth: number,
): GraphLayout {
  const n = graph.verticals.length
  // Lines run the full body, not just the lanes: a self-loop on the last
  // column writes its label to the right, where Lora keeps a spare column.
  const width = Math.max(gutter + n * laneWidth, bodyWidth)
  const centers = graph.verticals.map((_, i) => gutter + i * laneWidth + (laneWidth >> 1))
  const lines: GraphLine[] = []
  const rowLines: number[] = []

  const header = newLine(width)
  graph.verticals.forEach((vertical, i) => {
    const spans = headingSpans(vertical, laneWidth - 1)
    const start = gutter + i * laneWidth + Math.max(0, (laneWidth - 1 - spansLength(spans)) >> 1)
    drawSpans(header, start, spans)
  })
  lines.push(toSpans(header))

  const spacer = newLine(width)
  drawGuides(spacer, centers)
  lines.push(toSpans(spacer))

  for (const row of graph.horizontals) {
    const label = labelSegments(row.label, row.isRemainder)
    const labelLen = spansLength(label)
    const color = labelColor(row.label.type)
    const rep = row.representation

    const main = newLine(width)
    drawGuides(main, centers)
    drawTreePrefix(main, row, graph.horizontals, true)

    if (rep.kind === 'vector') {
      const a = centers[rep.fromVertical]!
      const b = centers[rep.toVertical]!
      const interior = b - a - 1
      for (let x = a; x <= b; x += 1) drawText(main, x, DASH, color)
      const leftTag = markerText(rep.direction === 'leftToRight' ? rep.fromTag : rep.toTag)
      const rightTag = markerText(rep.direction === 'leftToRight' ? rep.toTag : rep.fromTag)
      const tagsFit = leftTag.length + rightTag.length <= interior
      if (tagsFit) {
        drawText(main, a + 1, leftTag, COLORS.brass)
        drawText(main, b - rightTag.length, rightTag, COLORS.brass)
      }
      if (rep.direction === 'leftToRight') {
        drawText(main, a, NODE, color)
        drawText(main, b, HEAD_RIGHT, color)
      } else {
        drawText(main, b, NODE, color)
        drawText(main, a, HEAD_LEFT, color)
      }
      const tagRoom = tagsFit ? leftTag.length + rightTag.length : 0
      if (labelLen + 2 <= interior - tagRoom) {
        // ` label ` must sit strictly between the endpoint tags.
        const lo = a + 2 + (tagsFit ? leftTag.length : 0)
        const hi = b - (tagsFit ? rightTag.length : 0) - labelLen - 1
        const start = Math.min(hi, Math.max(lo, ((a + b) >> 1) - (labelLen >> 1)))
        drawText(main, start - 1, ' ', color)
        drawSpans(main, start, label)
        drawText(main, start + labelLen, ' ', color)
      } else {
        const above = newLine(width)
        drawGuides(above, centers)
        drawTreePrefix(above, row, graph.horizontals, false)
        const start = Math.max(
          0,
          Math.min(width - labelLen, ((a + b) >> 1) - (labelLen >> 1)),
        )
        drawSpans(above, start, label)
        lines.push(toSpans(above))
      }
    } else {
      const c = centers[rep.vertical]!
      const glyph = rep.kind === 'selfLoop' ? `${NODE}${LOOP}` : NODE
      // A loop from (3) to (3) says (3) once; a rekey loop keeps both ends.
      const tags =
        markerText(rep.fromTag) +
        (rep.kind === 'selfLoop' && rep.toTag !== rep.fromTag ? markerText(rep.toTag) : '')
      const spans: GraphSpan[] = [{ text: glyph, fg: color }]
      if (tags) spans.push({ text: tags, fg: COLORS.brass })
      spans.push({ text: ' ', fg: color }, ...label)
      const total = spansLength(spans)
      const start = Math.max(0, Math.min(c, width - total))
      drawSpans(main, start, spans)
    }

    rowLines.push(lines.length)
    lines.push(toSpans(main))
  }

  return { mode: 'lanes', lines, centers, rowLines }
}

function compactTreePrefix(row: GraphHorizontal, horizontals: readonly GraphHorizontal[]): string {
  if (row.depth === 0) return ''
  let prefix = ''
  for (let level = 1; level < row.depth; level += 1) {
    const ancestor = horizontals[row.ancestors[level]!]
    prefix += ancestor?.hasNextSibling ? `${GUIDE} ` : '  '
  }
  if (row.isRemainder) return `${prefix}${row.hasNextSibling ? GUIDE : ' '}  `
  return `${prefix}${row.hasNextSibling ? '├─' : '└─'} `
}

/** Drops an endpoint tag the entity name already carries as its own badge. */
function compactMarker(vertical: GraphVertical, tag: GraphMarkerTag | undefined): string {
  if (typeof tag === 'number') {
    if (vertical.type === 'account' && vertical.accountNumber === tag) return ''
    if (vertical.type === 'application' && vertical.linkedAccount?.accountNumber === tag) return ''
  }
  return markerText(tag)
}

function compactLayout(graph: TransactionsGraph, bodyWidth: number): GraphLayout {
  const lines: GraphLine[] = []
  const rowLines: number[] = []
  for (const row of graph.horizontals) {
    const rep = row.representation
    let route: string
    if (rep.kind === 'vector') {
      const senderIndex = rep.direction === 'leftToRight' ? rep.fromVertical : rep.toVertical
      const receiverIndex = rep.direction === 'leftToRight' ? rep.toVertical : rep.fromVertical
      const sender = graph.verticals[senderIndex]!
      const receiver = graph.verticals[receiverIndex]!
      route = `${verticalName(sender)}${compactMarker(sender, rep.fromTag)} → ${verticalName(
        receiver,
      )}${compactMarker(receiver, rep.toTag)}`
    } else {
      const vertical = graph.verticals[rep.vertical]!
      route = `${verticalName(vertical)}${compactMarker(vertical, rep.fromTag)}${
        rep.kind === 'selfLoop' ? ` ${LOOP}` : ''
      }`
    }
    const prefix = compactTreePrefix(row, graph.horizontals)
    const spans: GraphSpan[] = []
    if (prefix) spans.push({ text: prefix, fg: COLORS.faint })
    spans.push(...labelSegments(row.label, row.isRemainder))
    spans.push({ text: '  ', fg: COLORS.text }, { text: route, fg: COLORS.muted })
    rowLines.push(lines.length)
    lines.push(clipSpans(spans, bodyWidth))
  }
  return { mode: 'compact', lines, centers: [], rowLines }
}

/**
 * Lays the graph out for `bodyWidth` columns of text. Lanes get an equal
 * share of the width (clamped to [MIN_LANE_WIDTH, MAX_LANE_WIDTH]); when the
 * share falls under the minimum the layout falls back to the compact list.
 */
export function computeGraphLayout(graph: TransactionsGraph, bodyWidth: number): GraphLayout {
  if (graph.verticals.length === 0 || graph.horizontals.length === 0) {
    return { mode: 'compact', lines: [], centers: [], rowLines: [] }
  }
  const maxDepth = graph.horizontals.reduce((max, row) => Math.max(max, row.depth), 0)
  const gutter = maxDepth * 2
  const laneWidth = Math.min(
    MAX_LANE_WIDTH,
    Math.floor((bodyWidth - gutter) / graph.verticals.length),
  )
  if (laneWidth < MIN_LANE_WIDTH) return compactLayout(graph, bodyWidth)
  return laneLayout(graph, gutter, laneWidth, bodyWidth)
}

/**
 * A transaction row as the collection view model carries it — a subset of
 * the wire transaction, with uint64 ids possibly serialized as strings and,
 * when the record retains them, nested inner transactions.
 */
export interface GraphSourceRow {
  id?: string
  type?: string
  sender: string
  feeMicroAlgos?: number | string
  paymentAmountMicroAlgos?: number | string
  receiver?: string
  assetId?: number | string
  assetAmount?: number | string
  assetName?: string
  assetUnitName?: string
  assetDecimals?: number
  applicationId?: number | string
  onCompletion?: string
  closeTo?: string
  closeAmountMicroAlgos?: number | string
  closeAssetAmount?: number | string
  clawbackFrom?: string
  rekeyTo?: string
  createdAssetId?: number | string
  createdApplicationId?: number | string
  globalStateDelta?: unknown
  localStateDelta?: unknown
  logs?: string[]
  applicationArgs?: string[]
  methodName?: string
  methodArgs?: Array<{ name?: string; type: string; value?: unknown }>
  methodReturn?: unknown
  innerTxns?: GraphSourceRow[]
}

function toGraphTransaction(row: GraphSourceRow): GraphTransaction {
  // Spread, then coerce: a hand-copied field list here dropped rekeyTo and
  // createdApplicationId once each. Ids arrive as number | string on the wire.
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

/**
 * Builds the flow graph for a transaction.group card, with algosdk supplying
 * application escrow addresses. Returns undefined — table fallback — when
 * the rows are empty or the graph model rejects them.
 */
export function buildGroupGraph(rows: readonly GraphSourceRow[]): TransactionsGraph | undefined {
  if (rows.length === 0) return undefined
  try {
    const graph = buildTransactionsGraph(rows.map(toGraphTransaction), {
      appAddressFor: (applicationId) => getApplicationAddress(applicationId).toString(),
    })
    return graph.horizontals.length > 0 ? graph : undefined
  } catch {
    return undefined
  }
}
