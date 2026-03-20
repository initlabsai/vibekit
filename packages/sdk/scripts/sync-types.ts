/**
 * Reads resolved types from @vibekit/alpha-arcade's built .d.ts
 * and writes them to src/generated/alpha-arcade.ts so the published
 * SDK has no workspace dependencies.
 *
 * Run: bun run sync-types
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const alphaArcadeDts = resolve(root, '../alpha-arcade/dist/tools.d.ts')

let dts: string
try {
  dts = readFileSync(alphaArcadeDts, 'utf-8')
} catch {
  console.error('alpha-arcade not built. Run: bun run --filter @vibekit/alpha-arcade build')
  process.exit(1)
}

// Extract the return type objects from "export declare function formatX(...): { ... }"
const functions = ['formatMarket', 'formatOrderbook', 'formatPosition', 'formatOpenOrder'] as const
const typeNames = {
  formatMarket: 'FormattedMarket',
  formatOrderbook: 'FormattedOrderbook',
  formatPosition: 'FormattedPosition',
  formatOpenOrder: 'FormattedOpenOrder',
} as const

// Parse each function's return type from the .d.ts
// They appear as: "export declare function formatX(m: Type): { ...multiline... };"
const types: string[] = []

for (const fn of functions) {
  const typeName = typeNames[fn]
  // Match from the function declaration to the closing brace + semicolon
  const fnRegex = new RegExp(
    `export declare function ${fn}\\([^)]*\\):\\s*([\\s\\S]*?);\\n(?=export)`,
  )
  const match = dts.match(fnRegex)
  if (!match) {
    console.error(`Could not extract return type for ${fn}`)
    process.exit(1)
  }
  types.push(`export type ${typeName} = ${match[1].trim()}`)
}

const outDir = resolve(root, 'src/generated')
const outFile = resolve(outDir, 'alpha-arcade.ts')
mkdirSync(outDir, { recursive: true })

const content = `// Auto-generated from @vibekit/alpha-arcade — do not edit manually.
// Run \`bun run sync-types\` to regenerate.

${types.join('\n\n')}
`

writeFileSync(outFile, content)
console.log(`Wrote ${types.length} types to src/generated/alpha-arcade.ts`)
