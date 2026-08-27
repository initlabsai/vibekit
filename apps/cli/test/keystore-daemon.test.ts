import { describe, expect, test } from 'bun:test'

import { ensureKeystoreDaemon } from '../src/commands/keystore.js'

describe('ensureKeystoreDaemon', () => {
  test('does nothing when the daemon already answers', async () => {
    let started = 0
    const up = await ensureKeystoreDaemon({
      quiet: true,
      probe: async () => true,
      start: async () => {
        started += 1
        return 1
      },
    })
    expect(up).toBe(true)
    expect(started).toBe(0)
  })

  test('starts it once and waits for the socket', async () => {
    let probes = 0
    let started = 0
    const up = await ensureKeystoreDaemon({
      quiet: true,
      probe: async () => ++probes > 2,
      start: async () => {
        started += 1
        return 42
      },
      waitMs: 2000,
    })
    expect(up).toBe(true)
    expect(started).toBe(1)
  })

  test('reports failure when it never comes up or cannot start', async () => {
    expect(
      await ensureKeystoreDaemon({
        quiet: true,
        probe: async () => false,
        start: async () => 1,
        waitMs: 300,
      }),
    ).toBe(false)
    expect(
      await ensureKeystoreDaemon({
        quiet: true,
        probe: async () => false,
        start: async () => {
          throw new Error('npm missing')
        },
      }),
    ).toBe(false)
  })
})
