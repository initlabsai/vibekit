/** The app's components are copies of the package's: `vibekit add` would write exactly these. */
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE = join(import.meta.dir, '../../../../packages/vibekit/components')

test('components match the package source', () => {
  for (const file of ['companion.tsx', 'action.ts']) {
    expect(readFileSync(join(import.meta.dir, file), 'utf8')).toBe(readFileSync(join(SOURCE, file), 'utf8'))
  }
})
