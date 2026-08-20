import { describe, expect, test } from 'bun:test'
import { defineTool, ToolError, type AnyTool } from '@initlabs/vibekit-core'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { DISPLAY_META_KEY, VIEW_META_KEY, createVibekitMcp } from '../src/index.js'
import { resolveDeployment } from '../src/options.js'

const echo = defineTool({
  name: 'echo',
  description: 'Echo a value with a bigint round',
  parameters: z.object({ value: z.string() }),
  display: 'json',
  handler: async (ctx, args) => ({ value: args.value, round: BigInt(107), network: ctx.network.id }),
}) as AnyTool

const lookup = defineTool({
  name: 'lookup_thing',
  description: 'A read tool with an Explorer view',
  parameters: z.object({}),
  view: 'account.summary',
  handler: async () => ({ ok: true }),
}) as AnyTool

const boom = defineTool({
  name: 'boom',
  description: 'Always throws a ToolError',
  parameters: z.object({}),
  handler: async () => {
    throw new ToolError('KABOOM', 'it broke')
  },
}) as AnyTool

const writeTool = defineTool({
  name: 'write_thing',
  description: 'A write tool',
  parameters: z.object({}),
  requiresSigner: true,
  handler: async () => 'ok',
}) as AnyTool

async function connect(tools: AnyTool[]) {
  const server = createVibekitMcp({ network: 'localnet', mode: 'compose', tools })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'test', version: '0.0.0' })
  await client.connect(clientTransport)
  return client
}

describe('createVibekitMcp', () => {
  test('lists tools with annotations and display meta', async () => {
    const client = await connect([echo, writeTool, lookup])
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual(['echo', 'lookup_thing', 'write_thing'])

    const echoTool = tools.find((t) => t.name === 'echo')!
    expect(echoTool.annotations?.readOnlyHint).toBe(true)
    expect((echoTool._meta as Record<string, unknown>)?.[DISPLAY_META_KEY]).toBe('json')
    expect((echoTool._meta as Record<string, unknown>)?.[VIEW_META_KEY]).toBeUndefined()

    const write = tools.find((t) => t.name === 'write_thing')!
    expect(write.annotations?.readOnlyHint).toBe(false)

    const lookupTool = tools.find((t) => t.name === 'lookup_thing')!
    expect((lookupTool._meta as Record<string, unknown>)?.[VIEW_META_KEY]).toBe('account.summary')
    expect((lookupTool._meta as Record<string, unknown>)?.[DISPLAY_META_KEY]).toBeUndefined()
    await client.close()
  })

  test('calls a tool and returns jsonSafe results', async () => {
    const client = await connect([echo])
    const result = await client.callTool({ name: 'echo', arguments: { value: 'hi' } })
    const text = (result.content as Array<{ text: string }>)[0]!.text
    expect(JSON.parse(text)).toEqual({ value: 'hi', round: 107, network: 'localnet' })
    expect(result.isError ?? false).toBe(false)
    await client.close()
  })

  test('maps ToolError to isError with code', async () => {
    const client = await connect([boom])
    const result = await client.callTool({ name: 'boom', arguments: {} })
    expect(result.isError).toBe(true)
    expect((result.content as Array<{ text: string }>)[0]!.text).toBe('KABOOM: it broke')
    await client.close()
  })
})

describe('resolveDeployment validation', () => {
  test('rejects duplicate tool names at startup', () => {
    expect(() =>
      resolveDeployment({ network: 'localnet', mode: 'compose', tools: [echo, echo] }),
    ).toThrow('Duplicate tool name: echo')
  })

  test('rejects duplicate plugin names at startup', () => {
    const plugin = { name: 'p', tools: [] }
    expect(() =>
      resolveDeployment({ network: 'localnet', mode: 'compose', plugins: [plugin, plugin] }),
    ).toThrow('Duplicate plugin name: p')
  })

  test('rejects execute mode without a signer', () => {
    expect(() => resolveDeployment({ network: 'localnet', mode: 'execute', tools: [echo] })).toThrow(
      /requires resolveSigner/,
    )
  })

  test('injects plugin services under the plugin name', () => {
    const deployment = resolveDeployment({
      network: 'localnet',
      mode: 'compose',
      plugins: [{ name: 'nfd', tools: [], service: { hello: true } }],
    })
    expect(deployment.contexts.get('localnet')?.services['nfd']).toEqual({ hello: true })
  })

  test('pools contexts per network, default first, servedNetworks filled', () => {
    const deployment = resolveDeployment({
      network: 'testnet',
      networks: ['localnet', 'testnet'],
      mode: 'compose',
      tools: [echo],
    })
    expect(deployment.networkIds).toEqual(['testnet', 'localnet'])
    expect(deployment.defaultNetwork).toBe('testnet')
    expect(deployment.contexts.get('localnet')?.servedNetworks).toEqual(['testnet', 'localnet'])
    expect(deployment.contexts.get('localnet')?.defaultNetwork).toBe('testnet')
  })
})

describe('multi-network adapter (§10 state model)', () => {
  const connectMulti = async (tools: AnyTool[]) => {
    const server = createVibekitMcp({
      network: 'localnet',
      networks: ['testnet'],
      mode: 'compose',
      tools,
    })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await server.connect(serverTransport)
    const client = new Client({ name: 'test', version: '0.0.0' })
    await client.connect(clientTransport)
    return client
  }

  test('single-network deployments get no network parameter', async () => {
    const client = await connect([echo])
    const { tools } = await client.listTools()
    const schema = tools[0]!.inputSchema as { properties?: Record<string, unknown> }
    expect(schema.properties?.['network']).toBeUndefined()
    await client.close()
  })

  test('injects optional network on reads, required on writes', async () => {
    const client = await connectMulti([echo, writeTool])
    const { tools } = await client.listTools()
    const echoSchema = tools.find((t) => t.name === 'echo')!.inputSchema as {
      properties?: Record<string, unknown>
      required?: string[]
    }
    const writeSchema = tools.find((t) => t.name === 'write_thing')!.inputSchema as {
      properties?: Record<string, unknown>
      required?: string[]
    }
    expect(echoSchema.properties?.['network']).toBeDefined()
    expect(echoSchema.required ?? []).not.toContain('network')
    expect(writeSchema.properties?.['network']).toBeDefined()
    expect(writeSchema.required ?? []).toContain('network')
    await client.close()
  })

  test('routes calls to the requested network context, defaults otherwise', async () => {
    const client = await connectMulti([echo])
    const viaDefault = await client.callTool({ name: 'echo', arguments: { value: 'x' } })
    const viaTestnet = await client.callTool({
      name: 'echo',
      arguments: { value: 'x', network: 'testnet' },
    })
    const text = (r: unknown) =>
      JSON.parse(((r as { content: Array<{ text: string }> }).content[0] ?? { text: '{}' }).text)
    expect(text(viaDefault).network).toBe('localnet')
    expect(text(viaTestnet).network).toBe('testnet')
    await client.close()
  })

  test('write tool without network fails validation', async () => {
    const client = await connectMulti([writeTool])
    const result = await client.callTool({ name: 'write_thing', arguments: {} })
    expect(result.isError).toBe(true)
    await client.close()
  })

  test('rejects tools that declare a reserved network parameter', () => {
    const clash = defineTool({
      name: 'clash',
      description: 'declares network itself',
      parameters: z.object({ network: z.string() }),
      handler: async () => 'x',
    }) as AnyTool
    expect(() =>
      createVibekitMcp({ network: 'localnet', networks: ['testnet'], mode: 'compose', tools: [clash] }),
    ).toThrow(/reserved parameter name/)
  })
})
