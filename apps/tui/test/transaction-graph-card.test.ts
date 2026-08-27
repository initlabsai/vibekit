import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildTransactionsGraph,
  formatMicroAlgos,
  type GraphTransaction,
  type TransactionsGraph,
} from '@initlabs/vibekit-explorer'
import { getApplicationAddress } from 'algosdk'

import {
  buildGroupGraph,
  computeGraphLayout,
  labelColor,
  labelSegments,
  lineText,
  markerText,
  MIN_LANE_WIDTH,
  verticalName,
} from '../src/features/transactions/graph-layout.js'
import { COLORS } from '../src/theme.js'

const corpus = JSON.parse(
  readFileSync(
    join(import.meta.dir, '../../../packages/explorer/test/recorded/mainnet-graph-corpus.json'),
    'utf8',
  ),
) as {
  transactions: Record<string, GraphTransaction>
  groups: Record<string, { transactions: GraphTransaction[] }>
}

const appAddressFor = (applicationId: number) => getApplicationAddress(applicationId).toString()

function graphFor(transactions: GraphTransaction[]): TransactionsGraph {
  return buildTransactionsGraph(transactions, { appAddressFor })
}

const SWAP_ID = 'INDQXWQXHF22SO45EZY7V6FFNI6WUD5FHRVDV6NCU6HD424BJGGA'
const CLOSE_ID = 'GYZT5MEYJKR35U7CL3NUFCJVSAWBOQITRB3S5IQS2TWBZPD7E34A'
const AXFER_ID = '563MNGEL2OF4IBA7CFLIJNMBETT5QNKZURSLIONJBTJFALGYOAUA'
const GROUP_ID = 'wDegGrdXE32WoxPfioFELwPVWBIiZK0GF1bwos7fJs0='

const swapGraph = graphFor([corpus.transactions[SWAP_ID]!])
const closeGraph = graphFor([corpus.transactions[CLOSE_ID]!])
const axferGraph = graphFor([corpus.transactions[AXFER_ID]!])
const groupGraph = graphFor(corpus.groups[GROUP_ID]!.transactions)

const WIDE = 140

describe('lane layout', () => {
  test('one column per vertical, centers strictly increasing and in range', () => {
    for (const graph of [swapGraph, closeGraph, groupGraph]) {
      const layout = computeGraphLayout(graph, WIDE)
      expect(layout.mode).toBe('lanes')
      expect(layout.centers).toHaveLength(graph.verticals.length)
      for (let i = 1; i < layout.centers.length; i += 1) {
        expect(layout.centers[i]!).toBeGreaterThan(layout.centers[i - 1]!)
      }
      for (const line of layout.lines) {
        expect(lineText(line).length).toBeLessThanOrEqual(WIDE)
      }
    }
  })

  test('one content line per horizontal, tracked by rowLines', () => {
    const layout = computeGraphLayout(swapGraph, WIDE)
    expect(layout.rowLines).toHaveLength(swapGraph.horizontals.length)
    for (const index of layout.rowLines) {
      const text = lineText(layout.lines[index]!)
      expect(text).toMatch(/[●▶◀]/)
    }
  })

  test('column headers use the entity short-labels', () => {
    const layout = computeGraphLayout(swapGraph, WIDE)
    const header = lineText(layout.lines[0]!)
    expect(header).toContain('(1) ')
    expect(header).toContain('app 1201559522')
    // Application escrow marker: the linked account's badge follows the app id.
    const appVertical = swapGraph.verticals.find((v) => v.type === 'application')
    expect(appVertical?.type === 'application' && appVertical.linkedAccount).toBeTruthy()
    expect(header).toMatch(/app 1201559522 \(\d+\)/)
  })

  test('vectors draw the sender node and a direction-aware arrow head', () => {
    const layout = computeGraphLayout(swapGraph, WIDE)
    swapGraph.horizontals.forEach((row, index) => {
      if (row.representation.kind !== 'vector') return
      const rep = row.representation
      const text = lineText(layout.lines[layout.rowLines[index]!]!)
      const a = layout.centers[rep.fromVertical]!
      const b = layout.centers[rep.toVertical]!
      if (rep.direction === 'leftToRight') {
        expect(text[a]).toBe('●')
        expect(text[b]).toBe('▶')
      } else {
        expect(text[b]).toBe('●')
        expect(text[a]).toBe('◀')
      }
    })
    const directions = new Set(
      swapGraph.horizontals
        .map((row) => (row.representation.kind === 'vector' ? row.representation.direction : null))
        .filter((d) => d !== null),
    )
    // The swap flows both ways, so both arrow heads are exercised.
    expect(directions).toEqual(new Set(['leftToRight', 'rightToLeft']))
  })

  test('lanes carry no depth tree; guides sit under the first character of each heading', () => {
    const layout = computeGraphLayout(swapGraph, WIDE)
    const heading = lineText(layout.lines[0]!)
    for (const x of layout.centers) expect(heading[x]).not.toBe(' ')
    swapGraph.horizontals.forEach((row, index) => {
      const text = lineText(layout.lines[layout.rowLines[index]!]!)
      expect(text.slice(0, 2)).not.toMatch(/[├└]/)
    })
    const depths = new Set(swapGraph.horizontals.map((row) => row.depth))
    expect(Math.max(...depths)).toBeGreaterThanOrEqual(2)
  })

  test('close-out remainder rows are dim-labeled remainder', () => {
    const remainderIndex = closeGraph.horizontals.findIndex((row) => row.isRemainder)
    expect(remainderIndex).toBeGreaterThan(-1)
    const layout = computeGraphLayout(closeGraph, WIDE)
    const start = remainderIndex === 0 ? 2 : layout.rowLines[remainderIndex - 1]! + 1
    const rowText = layout.lines
      .slice(start, layout.rowLines[remainderIndex]! + 1)
      .map(lineText)
      .join('\n')
    expect(rowText).toContain('remainder')
  })

  test('payment labels carry the microALGO amount on the line', () => {
    const pay = groupGraph.horizontals.find(
      (row) => row.label.type === 'payment' && row.label.amountMicroAlgos !== undefined,
    )
    expect(pay).toBeDefined()
    const expected = `${formatMicroAlgos(pay!.label.amountMicroAlgos!)} ALGO`
    const layout = computeGraphLayout(groupGraph, WIDE)
    expect(layout.lines.map(lineText).join('\n')).toContain(expected)
  })

  test('an op-up appl gets the OpUp column', () => {
    const opUp: GraphTransaction = {
      type: 'appl',
      sender: corpus.transactions[AXFER_ID]!.sender,
      feeMicroAlgos: 1000,
      applicationId: 0,
      onCompletion: 'delete',
    }
    const graph = graphFor([opUp])
    expect(graph.verticals.some((v) => v.type === 'opUp')).toBe(true)
    const layout = computeGraphLayout(graph, 80)
    expect(lineText(layout.lines[0]!)).toContain('OpUp')
  })

  test('layout is deterministic', () => {
    expect(computeGraphLayout(swapGraph, 100)).toEqual(computeGraphLayout(swapGraph, 100))
  })
})

describe('compact fallback', () => {
  test('kicks in when lanes would fall under the minimum width', () => {
    const columns = swapGraph.verticals.length
    const tooNarrow = columns * MIN_LANE_WIDTH - 1 // one column short of the minimum lane
    const layout = computeGraphLayout(swapGraph, tooNarrow)
    expect(layout.mode).toBe('compact')
    expect(layout.centers).toHaveLength(0)
    expect(layout.rowLines).toHaveLength(swapGraph.horizontals.length)
    for (const line of layout.lines) {
      expect(lineText(line).length).toBeLessThanOrEqual(tooNarrow)
    }
  })

  test('rows read as label plus from → to', () => {
    const layout = computeGraphLayout(swapGraph, 48)
    expect(layout.mode).toBe('compact')
    const text = layout.lines.map(lineText).join('\n')
    expect(text).toContain(' → ')
    expect(text).toContain('appCall')
    const remainderLayout = computeGraphLayout(closeGraph, 48)
    expect(remainderLayout.lines.map(lineText).join('\n')).toContain('remainder')
  })

  test('wide lane mode survives for a single simple transfer', () => {
    const layout = computeGraphLayout(axferGraph, 60)
    expect(layout.mode).toBe('lanes')
  })
})

describe('labels, markers, and names', () => {
  test('marker tags render as (n) and (rk)', () => {
    expect(markerText(3)).toBe('(3)')
    expect(markerText('rekey')).toBe('(rk)')
    expect(markerText(undefined)).toBe('')
  })

  test('label families reuse existing palette members', () => {
    expect(labelColor('payment')).toBe(COLORS.brass)
    expect(labelColor('paymentRemainder')).toBe(COLORS.brass)
    expect(labelColor('assetTransfer')).toBe(COLORS.signal)
    expect(labelColor('clawback')).toBe(COLORS.brassBright)
    expect(labelColor('appCall')).toBe(COLORS.brassBright)
    expect(labelColor('keyReg')).toBe(COLORS.text)
  })

  test('asset transfers format base units with the unit name', () => {
    const text = labelSegments(
      { type: 'assetTransfer', assetAmount: 1500000, assetDecimals: 6, assetUnitName: 'USDC' },
      false,
    )
      .map((s) => s.text)
      .join('')
    expect(text).toBe('1.5 USDC')
  })

  test('unknown future label types render generically as their type text', () => {
    const text = labelSegments({ type: 'assetFreeze' as never }, false)
      .map((s) => s.text)
      .join('')
    expect(text).toBe('assetFreeze')
  })

  test('vertical names elide addresses and mark app escrows', () => {
    const account = swapGraph.verticals.find((v) => v.type === 'account')
    expect(account && verticalName(account)).toMatch(/^\(\d+\) .{4}….{4}$/)
    const app = swapGraph.verticals.find((v) => v.type === 'application')
    expect(app && verticalName(app)).toMatch(/^app \d+ \(\d+\)$/)
  })
})

describe('buildGroupGraph adapter', () => {
  const sender = 'IWT4WOUKYQBCAO76UKWZ5E4CPIJVLBE5R3NX5QH3BXMTG34WU7ZCLJ4RVY'
  const receiver = '2ZPNLKXWCOUJ2ONYWZEIWOUYRXL36VCIBGJ4ZJ2AAGET5SIRTHKSNFDJJ4'

  test('builds a graph from collection-shaped rows, coercing uint64 ids', () => {
    const graph = buildGroupGraph([
      { type: 'pay', sender, receiver, paymentAmountMicroAlgos: 500000, feeMicroAlgos: 1000 },
      {
        type: 'axfer',
        sender,
        receiver,
        assetId: '31566704',
        assetAmount: 25,
        feeMicroAlgos: '1000',
        innerCount: 0,
      } as never,
    ])
    expect(graph).toBeDefined()
    expect(graph!.horizontals).toHaveLength(2)
    expect(graph!.horizontals[1]!.label.assetId).toBe(31566704)
  })

  test('passes nested innerTxns through when rows carry them', () => {
    const graph = buildGroupGraph(corpus.groups[GROUP_ID]!.transactions)
    expect(graph).toBeDefined()
    expect(graph!.horizontals.some((row) => row.depth > 0)).toBe(true)
  })

  test('returns undefined for empty or unbuildable rows', () => {
    expect(buildGroupGraph([])).toBeUndefined()
    expect(buildGroupGraph([{ type: 'wat', sender }])).toBeUndefined()
  })
})

test('a zero self-payment carrying rekeyTo reaches the graph as a rekey row', () => {
  const user = 'URKF45CZ5Q6QW6VQKQWGQJ3FQKXGDQ2Q2CCFJ2XM7UNQ3OQYZ3PSNDHZ6Y'
  const graph = buildGroupGraph([
    {
      type: 'pay',
      sender: user,
      receiver: user,
      paymentAmountMicroAlgos: 0,
      rekeyTo: 'X5HRVWKG5ZFOCAFXQHH2JPEQJZ3WQGBSSTKZRWCEFZHOUZRWXNM2H3VEXM',
    },
  ])
  expect(graph?.horizontals[0]?.label.type).toBe('rekey')
})

test('an inner app create resolves to its created id on the way into the graph', () => {
  const user = 'URKF45CZ5Q6QW6VQKQWGQJ3FQKXGDQ2Q2CCFJ2XM7UNQ3OQYZ3PSNDHZ6Y'
  const graph = buildGroupGraph([
    {
      type: 'appl',
      sender: user,
      applicationId: 10,
      innerTxns: [{ type: 'appl', sender: user, applicationId: 0, createdApplicationId: '77' }],
    },
  ])
  expect(
    graph?.verticals.map((v) => (v.type === 'application' ? v.applicationId : v.type)),
  ).toEqual(['account', 10, 77])
})
