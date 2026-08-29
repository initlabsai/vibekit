import { expect, test } from 'bun:test'

import { defaultPlugins, defaultTools, networksFromEnv } from '../../src/preset/index.js'

test('the preset wires every domain and plugin, and reads the env convention', () => {
  expect(defaultTools.length).toBeGreaterThan(20)
  expect(new Set(defaultTools.map((tool) => tool.name)).size).toBe(defaultTools.length)
  expect(defaultPlugins().map((plugin) => plugin.name)).toEqual([
    'nfd',
    'alpha-arcade',
    'vestige',
    'pera',
    'web',
  ])

  const defaults = { network: 'localnet' as const, networks: [] }
  expect(networksFromEnv(defaults, {})).toEqual({ network: 'localnet', networks: [] })
  expect(networksFromEnv(defaults, { NETWORK: 'mainnet', NETWORKS: 'testnet, mainnet' })).toEqual({
    network: 'mainnet',
    networks: ['testnet', 'mainnet'],
  })
})
