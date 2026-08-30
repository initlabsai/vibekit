/** These files are what `vibekit add` writes; they must match the package source. */
import { expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE = join(import.meta.dir, '../../../../packages/vibekit/components')

test('components match the package source', () => {
  for (const file of readdirSync(import.meta.dir).filter((name) => !name.endsWith('.test.ts'))) {
    expect(readFileSync(join(import.meta.dir, file), 'utf8')).toBe(readFileSync(join(SOURCE, file), 'utf8'))
  }
})
