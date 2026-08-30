/**
 * Pure geometry for the drawn flow graph: where each entity's lifeline sits
 * and where each row's origin, target, and caption go, for a given width.
 * The renderer draws exactly this and decides nothing.
 */
import type { GraphHorizontal, GraphMarkerTag, GraphVertical, TransactionsGraph } from '@initlabs/vibekit/views'

export const ROW = 40
export const TOP = 34
export const PAD_X = 24
export const MIN_LANE = 150
export const MAX_LANE = 280
/** Approximate mono glyph width at the graph's font size. */
export const CHAR = 7.2

export type RowGeometry =
  | { kind: 'vector'; y: number; a: number; b: number; origin: number; target: number; dir: 'left' | 'right'; leftTag: string; rightTag: string; captionInline: boolean; captionX: number }
  | { kind: 'selfLoop'; y: number; x: number; loopWidth: number; captionX: number; tags: string }
  | { kind: 'point'; y: number; x: number; captionX: number; tags: string }

export interface GraphGeometry {
  lane: number
  centers: number[]
  width: number
  height: number
  rows: RowGeometry[]
}

export function marker(tag: GraphMarkerTag | undefined): string {
  return tag === undefined ? '' : tag === 'rekey' ? '(rk)' : `(${tag})`
}

/** An end tag that repeats its own column's account number says nothing. */
export function endTag(vertical: GraphVertical, tag: GraphMarkerTag | undefined): string {
  if (tag === undefined) return ''
  if (vertical.type === 'account' && tag === vertical.accountNumber) return ''
  if (vertical.type === 'application' && vertical.linkedAccount?.accountNumber === tag) return ''
  return marker(tag)
}

export function layoutGraph(graph: TransactionsGraph, width: number, captionOf: (row: GraphHorizontal) => string): GraphGeometry {
  const n = graph.verticals.length
  const lane = Math.max(MIN_LANE, Math.min(MAX_LANE, (width - PAD_X * 2) / Math.max(1, n - 0.5)))
  const centers = graph.verticals.map((_, i) => PAD_X + i * lane)
  const total = Math.max(width, (centers[n - 1] ?? 0) + lane * 0.6)
  const rows: RowGeometry[] = graph.horizontals.map((row, r) => {
    const y = TOP + r * ROW + ROW / 2
    const rep = row.representation
    const captionW = captionOf(row).length * CHAR + 12
    if (rep.kind === 'point') {
      const x = centers[rep.vertical]!
      return { kind: 'point', y, x, captionX: x + 12, tags: marker(rep.fromTag) }
    }
    if (rep.kind === 'selfLoop') {
      const x = centers[rep.vertical]!
      const loopWidth = Math.min(lane * 0.45, 56)
      return { kind: 'selfLoop', y, x, loopWidth, captionX: x + loopWidth + 16, tags: `${marker(rep.fromTag)}${marker(rep.toTag)}` }
    }
    const a = centers[rep.fromVertical]!
    const b = centers[rep.toVertical]!
    const leftToRight = rep.direction === 'leftToRight'
    const leftTag = endTag(graph.verticals[rep.fromVertical]!, leftToRight ? rep.fromTag : rep.toTag)
    const rightTag = endTag(graph.verticals[rep.toVertical]!, leftToRight ? rep.toTag : rep.fromTag)
    const interior = b - a - 16 - (leftTag.length + rightTag.length) * CHAR
    return {
      kind: 'vector',
      y,
      a,
      b,
      origin: leftToRight ? a : b,
      target: leftToRight ? b : a,
      dir: leftToRight ? 'right' : 'left',
      leftTag,
      rightTag,
      captionInline: captionW <= interior,
      captionX: (a + b) / 2,
    }
  })
  return { lane, centers, width: total, height: TOP + graph.horizontals.length * ROW + 8, rows }
}
