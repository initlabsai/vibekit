import { describe, expect, test } from 'bun:test'
import { resolveNetwork, type NetworkId } from '../../../src/core/index.js'
import { peraPlugin, peraTools, getPera } from '../../../src/plugins/pera/index.js'

const ctxFor = (network: NetworkId, service?: unknown) =>
  ({ network: resolveNetwork(network), services: service ? { pera: service } : {} }) as never

describe('pera plugin', () => {
  test('exports 1 read-only tool with output schema and view', () => {
    expect(peraTools.map((t) => t.name)).toEqual(['get_asset_profile'])
    for (const tool of peraTools) {
      expect(tool.requiresSigner ?? false).toBe(false)
      expect(tool.output).toBeDefined()
      expect(tool.view).toBeDefined()
    }
  })

  test('network and registration guards throw ToolErrors', () => {
    expect(() => getPera(ctxFor('mainnet'))).toThrow('not registered')
    expect(() => getPera(ctxFor('localnet', peraPlugin().service))).toThrow(
      'mainnet and testnet only',
    )
  })

  test('maps the wire profile, dropping empty strings and nulls', async () => {
    const service = {
      get: async (networkId: string, path: string) => {
        expect(networkId).toBe('mainnet')
        expect(path).toBe('/public/assets/7/')
        return {
          asset_id: 7,
          name: 'GONNA',
          unit_name: 'GONNA',
          url: 'rug.ninja',
          logo: null,
          verification_tier: 'verified',
          usd_value: '0.000000049233',
          usd_value_24_hour_ago: '',
          is_collectible: false,
          description: 'The official coin of the Gonnaverse',
          verification_details: {
            project_name: 'GONNA',
            project_url: 'https://gonna.bond',
            project_description: '',
            discord_url: '',
            telegram_url: '',
            twitter_username: 'gonnalgo',
          },
        }
      },
    }
    const result = await peraTools[0]!.handler(ctxFor('mainnet', service), { assetId: 7 })
    expect(result).toEqual({
      assetId: 7,
      verificationTier: 'verified',
      name: 'GONNA',
      unitName: 'GONNA',
      url: 'rug.ninja',
      priceUsd: '0.000000049233',
      isCollectible: false,
      description: 'The official coin of the Gonnaverse',
      project: { name: 'GONNA', url: 'https://gonna.bond', twitter: 'gonnalgo' },
    })
  })
})
