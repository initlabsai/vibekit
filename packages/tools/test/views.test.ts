import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
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
      feeMicroAlgos: 1_000,
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
      closeAssetAmount: 10,
      innerTxns: [{ sender: 'INNER', feeMicroAlgos: 0 }],
    }
    const parsed = viewDataSchemas['transaction.detail'].safeParse(detail)
    expect(parsed.success).toBe(true)
  })
})

// The ./views subpath is the browser-safe import: its whole transitive
// module graph must stay zod-only (schema modules and nothing else), so a
// bundler never drags algosdk or node-only code into a page.
describe('views import graph', () => {
  test('src/views.ts transitively imports only zod and schema modules', () => {
    const srcDir = resolve(import.meta.dir, '../src')
    const entry = resolve(srcDir, 'views.ts')
    const seen = new Set<string>()
    const queue = [entry]
    while (queue.length > 0) {
      const file = queue.pop()!
      if (seen.has(file)) continue
      seen.add(file)
      const source = readFileSync(file, 'utf8')
      const specifiers = [
        // `import ... from 'x'` and `export ... from 'x'` clauses.
        ...[...source.matchAll(/^(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!),
        // Bare side-effect imports: `import 'x'`.
        ...[...source.matchAll(/^import\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!),
      ]
      for (const specifier of specifiers) {
        if (specifier === 'zod') continue
        // Anything that is not zod must be another local schema-only module.
        expect(specifier).toMatch(/^\.\.?\/.*schemas\.js$/)
        queue.push(resolve(dirname(file), specifier.replace(/\.js$/, '.ts')))
      }
    }
    // views.ts plus the six schema modules it reaches.
    expect(seen.size).toBe(7)
  })
})
