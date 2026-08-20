import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { resolveExploreEntry } from '../src/commands/explore.js'

describe('resolveExploreEntry', () => {
  test('prefers VIBEKIT_EXPLORE when that path exists', () => {
    const override = '/opt/vibekit-tui'
    expect(
      resolveExploreEntry({
        env: { VIBEKIT_EXPLORE: override },
        startDirs: ['/tmp'],
        exists: (path) => path === override,
      }),
    ).toBe(override)
  })

  test('finds the workspace TUI by walking up from cwd', () => {
    const repo = '/home/dev/vibekit'
    const entry = join(repo, 'apps/tui/src/index.tsx')
    expect(
      resolveExploreEntry({
        env: {},
        startDirs: [join(repo, 'apps/cli')],
        exists: (path) => path === entry,
      }),
    ).toBe(entry)
  })

  test('accepts a sidecar binary next to the CLI', () => {
    const bindir = '/usr/local/bin'
    const sidecar = join(bindir, 'vibekit-tui')
    expect(
      resolveExploreEntry({
        env: {},
        startDirs: [bindir],
        exists: (path) => path === sidecar,
      }),
    ).toBe(sidecar)
  })

  test('returns undefined when nothing is present', () => {
    expect(
      resolveExploreEntry({
        env: {},
        startDirs: ['/tmp'],
        exists: () => false,
      }),
    ).toBeUndefined()
  })
})
