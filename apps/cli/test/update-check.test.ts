import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { updateNudge } from '../src/update-check.js'
import { VERSION } from '../src/version.js'

/** A fresh cache pins the answer, so no network is touched. */
function seedCache(latest: string): void {
  const dir = mkdtempSync(join(tmpdir(), 'vibekit-update-test-'))
  process.env.XDG_CONFIG_HOME = dir
  mkdirSync(join(dir, 'vibekit'))
  writeFileSync(
    join(dir, 'vibekit', 'update-check.json'),
    JSON.stringify({ checkedAt: Date.now(), latest }),
  )
}

describe('updateNudge', () => {
  test('newer cached release yields the nudge with the install command', async () => {
    seedCache('999.0.0')
    const nudge = await updateNudge()
    expect(nudge).toContain('999.0.0')
    expect(nudge).toContain(VERSION)
    expect(nudge).toContain('getvibekit.ai')
  })

  test('current or older release stays silent', async () => {
    seedCache(VERSION)
    expect(await updateNudge()).toBeNull()
    seedCache('0.0.1')
    expect(await updateNudge()).toBeNull()
  })
})
