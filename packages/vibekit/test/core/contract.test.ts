import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { defineTool } from '../../src/core/contract.js'
import { ToolError } from '../../src/core/errors.js'
import { createNetworkClients, resolveNetwork } from '../../src/core/network.js'

describe('defineTool', () => {
  test('preserves the definition and infers args', async () => {
    const tool = defineTool({
      name: 'echo',
      description: 'echo',
      output: z.unknown(),
      parameters: z.object({ value: z.string() }),
      view: 'transaction.detail',
      handler: async (_ctx, args) => args.value.toUpperCase(), // args typed, not unknown
    })
    expect(tool.name).toBe('echo')
    expect(tool.requiresSigner).toBeUndefined()
    expect(tool.view).toBe('transaction.detail')
  })
})

describe('ToolError', () => {
  test('carries a stable code', () => {
    const err = new ToolError('INVALID_ADDRESS', 'bad address')
    expect(err.code).toBe('INVALID_ADDRESS')
    expect(err.name).toBe('ToolError')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('network', () => {
  test('derives scheme ports when unspecified (algosdk would default to :8080)', async () => {
    const { defaultPort } = await import('../../src/core/network.js')
    expect(defaultPort({ url: 'https://testnet-idx.algonode.cloud' })).toBe(443)
    expect(defaultPort({ url: 'http://localhost' })).toBe(80)
    expect(defaultPort({ url: 'http://localhost', port: 4001 })).toBe(4001)
  })

  test('named networks resolve', () => {
    expect(resolveNetwork('testnet').algod.url).toContain('testnet')
    expect(resolveNetwork('localnet').algod.token).toHaveLength(64)
  })

  test('custom config passes through and builds clients', () => {
    const clients = createNetworkClients({
      id: 'my-private-net',
      algod: { url: 'http://10.0.0.5', port: 4001, token: 'x'.repeat(64) },
      indexer: { url: 'http://10.0.0.5', port: 8980 },
    })
    expect(clients.network.id).toBe('my-private-net')
    expect(clients.algod).toBeDefined()
    expect(clients.indexer).toBeDefined()
  })
})
