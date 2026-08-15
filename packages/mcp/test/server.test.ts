import { describe, expect, test } from 'bun:test'
import { defineTool, ToolError, type AnyTool } from '@initlabs/core'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { DISPLAY_META_KEY, createVibekitMcp } from '../src/index.js'
import { resolveDeployment } from '../src/options.js'

const echo = defineTool({
  name: 'echo',
  description: 'Echo a value with a bigint round',
  parameters: z.object({ value: z.string() }),
  display: 'json',
  handler: async (ctx, args) => ({ value: args.value, round: BigInt(107), network: ctx.network.id }),
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
    const client = await connect([echo, writeTool])
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual(['echo', 'write_thing'])

    const echoTool = tools.find((t) => t.name === 'echo')!
    expect(echoTool.annotations?.readOnlyHint).toBe(true)
    expect((echoTool._meta as Record<string, unknown>)?.[DISPLAY_META_KEY]).toBe('json')

    const write = tools.find((t) => t.name === 'write_thing')!
    expect(write.annotations?.readOnlyHint).toBe(false)
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
    expect(deployment.context.services['nfd']).toEqual({ hello: true })
  })
})
