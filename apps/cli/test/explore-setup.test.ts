import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { commandExploreSetup, parseExploreSetupFlags } from '../src/commands/explore-setup.js'

describe('vibekit explore setup', () => {
  test('parses headless flags', () => {
    expect(
      parseExploreSetupFlags(['--provider', 'zerosignal', '--model', 'llama-3.3-70b']),
    ).toEqual({ provider: 'zerosignal', model: 'llama-3.3-70b' })
    expect(parseExploreSetupFlags(['--base-url', 'http://box:8000/v1'])).toEqual({
      baseUrl: 'http://box:8000/v1',
    })
  })

  test('headless flags write the config file without prompting', async () => {
    const xdg = mkdtempSync(join(tmpdir(), 'vibekit-setup-'))
    const prior = process.env.XDG_CONFIG_HOME
    process.env.XDG_CONFIG_HOME = xdg
    try {
      await commandExploreSetup(['--provider', 'zerosignal', '--model', 'llama-3.3-70b'])
      const written = JSON.parse(readFileSync(join(xdg, 'vibekit', 'config.json'), 'utf8'))
      expect(written.agent).toEqual({ provider: 'zerosignal', model: 'llama-3.3-70b' })
    } finally {
      if (prior === undefined) delete process.env.XDG_CONFIG_HOME
      else process.env.XDG_CONFIG_HOME = prior
    }
  })
})
