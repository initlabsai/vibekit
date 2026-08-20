import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { accountTools } from '../src/accounts/index.js'
import { assetTools, assetWriteTools } from '../src/assets/index.js'
import { contractTools, contractWriteTools } from '../src/contracts/index.js'
import { networkTools } from '../src/network/index.js'
import { transactionTools } from '../src/transactions/index.js'
import { transactionWriteTools } from '../src/transactions/tools-write.js'
import { viewDataSchemas, type ViewData } from '../src/views.js'

const allTools = [
  ...accountTools,
  ...assetTools,
  ...assetWriteTools,
  ...contractTools,
  ...contractWriteTools,
  ...networkTools,
  ...transactionTools,
  ...transactionWriteTools,
]

const dottedViewTools = allTools.filter((t) => typeof t.view === 'string' && t.view.includes('.'))

describe('viewDataSchemas', () => {
  test('covers every dotted view declared by a tool in this package', () => {
    expect(dottedViewTools.length).toBeGreaterThan(0)
    const declared = new Set(dottedViewTools.map((t) => t.view as string))
    expect([...declared].sort()).toEqual(Object.keys(viewDataSchemas).sort())
  })

  // Pins the map to the tool declarations: each tool's output IS the mapped
  // schema — by reference, so the two cannot drift and one view id stays
  // one shape.
  test.each(dottedViewTools.map((t) => [t.name, t.view as keyof typeof viewDataSchemas] as const))(
    '%s output is viewDataSchemas[%s]',
    (name, view) => {
      const mapped = viewDataSchemas[view]
      expect(mapped).toBeDefined()
      const tool = dottedViewTools.find((t) => t.name === name)!
      expect(mapped === tool.output).toBe(true)
    },
  )

  test('ViewData<"transaction.detail"> assembled from a recorded fixture parses', () => {
    // The jsonSafe wire shape of the enriched axfer fixture in transactions.test.ts.
    const detail: ViewData<'transaction.detail'> = {
      id: 'TXID',
      type: 'axfer',
      sender: 'CLAWBACK',
      fee: 0.001,
      confirmedRound: 64_241_214,
      roundTime: 1_787_169_296,
      rekeyTo: 'REKEY',
      assetId: 849_191_641,
      assetAmount: 52_000,
      assetName: 'Coop Coin',
      assetUnitName: 'COOP',
      assetDecimals: 2,
      receiver: 'RECEIVER',
      clawbackFrom: 'VICTIM',
      closeTo: 'CLOSE',
      closeAmount: 10,
      innerTxns: [{ sender: 'INNER', fee: 0 }],
    }
    const parsed = viewDataSchemas['transaction.detail'].safeParse(detail)
    expect(parsed.success).toBe(true)
  })
})
