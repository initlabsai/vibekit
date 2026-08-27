import { describe, expect, test } from 'bun:test'

import {
  LOCALNET_PROJECT,
  composeFileStatus,
  getAlgodConfigJson,
  getAlgodNetworkTemplate,
  getComposeYaml,
  getConduitYaml,
} from '../src/commands/localnet/compose.js'

describe('compose file generation', () => {
  test('compose yaml names the project and all four services', () => {
    const yaml = getComposeYaml()
    expect(yaml).toContain(`name: "${LOCALNET_PROJECT}"`)
    for (const service of ['algod:', 'conduit:', 'indexer-db:', 'indexer:']) {
      expect(yaml).toContain(service)
    }
  })

  test('compose yaml publishes the AlgoKit-compatible ports', () => {
    const yaml = getComposeYaml()
    expect(yaml).toContain('- 4001:8080') // algod
    expect(yaml).toContain('- 4002:7833') // kmd
    expect(yaml).toContain('- 8980:8980') // indexer
  })

  test('algod config is valid JSON with the developer API enabled', () => {
    const config = JSON.parse(getAlgodConfigJson()) as Record<string, unknown>
    expect(config.EnableDeveloperAPI).toBe(true)
    expect(config.Archival).toBe(true)
  })

  test('network template is valid JSON after NUM_ROUNDS substitution, DevMode on', () => {
    const template = JSON.parse(getAlgodNetworkTemplate().replace('NUM_ROUNDS', '30000')) as {
      Genesis: { DevMode: boolean; Wallets: unknown[] }
      Nodes: unknown[]
    }
    expect(template.Genesis.DevMode).toBe(true)
    expect(template.Genesis.Wallets).toHaveLength(3)
    expect(template.Nodes).toHaveLength(2)
  })

  test('conduit config wires the follower node to the postgres exporter', () => {
    const conduit = getConduitYaml()
    expect(conduit).toContain('follower-node-url: "http://algod:8081"')
    expect(conduit).toContain('name: postgresql')
  })
})

describe('composeFileStatus', () => {
  const latest = {
    compose: getComposeYaml(),
    algodConfig: getAlgodConfigJson(),
    networkTemplate: getAlgodNetworkTemplate(),
  }

  test('missing when no compose file', () => {
    expect(composeFileStatus({ compose: null, algodConfig: null, networkTemplate: null })).toBe(
      'missing',
    )
  })

  test('out-of-date when compose exists but algod config is missing', () => {
    expect(
      composeFileStatus({ compose: latest.compose, algodConfig: null, networkTemplate: null }),
    ).toBe('out-of-date')
  })

  test('up-to-date when all files match the generated content', () => {
    expect(composeFileStatus(latest)).toBe('up-to-date')
  })

  test('out-of-date when any file differs', () => {
    expect(composeFileStatus({ ...latest, compose: latest.compose + '\n# edited' })).toBe(
      'out-of-date',
    )
  })
})
