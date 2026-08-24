import { describe, expect, test } from 'bun:test'

import { serializeToml } from '../src/utils/toml.js'

describe('serializeToml', () => {
  test('serializes nested MCP server sections', () => {
    const toml = serializeToml({
      mcp_servers: {
        vibekit: {
          command: '/usr/local/bin/vibekit',
          args: ['mcp'],
          env: { NETWORK: 'localnet' },
        },
        kapa: { url: 'https://algorand-docs.mcp.kapa.ai/' },
      },
    })

    expect(toml).toContain('[mcp_servers.vibekit]')
    expect(toml).toContain('command = "/usr/local/bin/vibekit"')
    expect(toml).toContain('args = ["mcp"]')
    expect(toml).toContain('[mcp_servers.vibekit.env]')
    expect(toml).toContain('NETWORK = "localnet"')
    expect(toml).toContain('[mcp_servers.kapa]')
    expect(toml).toContain('url = "https://algorand-docs.mcp.kapa.ai/"')
  })

  test('escapes backslashes and quotes in strings', () => {
    const toml = serializeToml({ section: { path: 'C:\\Users\\dev', quoted: 'say "hi"' } })
    expect(toml).toContain('path = "C:\\\\Users\\\\dev"')
    expect(toml).toContain('quoted = "say \\"hi\\""')
  })

  test('rejects unsupported value types', () => {
    expect(() => serializeToml({ bad: undefined })).toThrow()
  })
})
