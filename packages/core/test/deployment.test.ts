import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { defineTool, executeToolCall, resolveDeployment, ToolError } from '../src/index.js'

const readTool = defineTool({
  name: 'where',
  description: 'Report network.',
  parameters: z.object({}),
  handler: async (ctx) => ({ network: ctx.network.id }),
})

const writeTool = defineTool({
  name: 'spend',
  description: 'A chain write.',
  parameters: z.object({ amount: z.number() }),
  requiresSigner: true,
  handler: async (ctx, args) => ({ network: ctx.network.id, amount: args.amount, big: 7n }),
})

const multi = () =>
  resolveDeployment({
    network: 'localnet',
    networks: ['localnet', 'testnet'],
    mode: 'compose',
    tools: [readTool, writeTool],
  })

describe('executeToolCall', () => {
  test('routes the network param and strips it from handler args', async () => {
    const result = await executeToolCall(multi(), readTool, { network: 'testnet' })
    expect(result).toEqual({ network: 'testnet' })
  })

  test('reads fall back to the default network', async () => {
    const result = await executeToolCall(multi(), readTool, {})
    expect(result).toEqual({ network: 'localnet' })
  })

  test('ENFORCES explicit network on requiresSigner tools (not just via schema)', async () => {
    expect(executeToolCall(multi(), writeTool, { amount: 1 })).rejects.toMatchObject({
      code: 'NETWORK_REQUIRED',
    })
  })

  test('write with explicit network passes and results are JSON-safe', async () => {
    const result = await executeToolCall(multi(), writeTool, { amount: 1, network: 'testnet' })
    expect(result).toEqual({ network: 'testnet', amount: 1, big: 7 })
  })

  test('unknown network is rejected', async () => {
    expect(executeToolCall(multi(), readTool, { network: 'mainnet' })).rejects.toMatchObject({
      code: 'UNKNOWN_NETWORK',
    })
  })

  test('single-network deployments never require the param', async () => {
    const single = resolveDeployment({ network: 'localnet', mode: 'compose', tools: [writeTool] })
    const result = await executeToolCall(single, writeTool, { amount: 2 })
    expect(result).toMatchObject({ network: 'localnet', amount: 2 })
  })
})

describe('output schema enforcement', () => {
  const single = (tool: ReturnType<typeof defineTool>) =>
    resolveDeployment({ network: 'localnet', mode: 'compose', tools: [tool] })

  test('validates against the post-jsonSafe shape, not the raw handler result', async () => {
    const tool = defineTool({
      name: 'big_read',
      description: 'Returns bigint + bytes.',
      parameters: z.object({}),
      output: z.object({ big: z.number(), bytes: z.string() }),
      handler: async () => ({ big: 7n, bytes: new Uint8Array([1, 2, 3]) }),
    })
    const result = await executeToolCall(single(tool), tool, {})
    expect(result).toEqual({ big: 7, bytes: 'AQID' })
  })

  test('a result violating the output schema throws OUTPUT_MISMATCH with the field path', async () => {
    const tool = defineTool({
      name: 'liar',
      description: 'Schema says number, handler returns string.',
      parameters: z.object({}),
      output: z.object({ value: z.number() }),
      handler: async () => ({ value: 'not-a-number' }),
    })
    expect(executeToolCall(single(tool), tool, {})).rejects.toMatchObject({
      code: 'OUTPUT_MISMATCH',
      message: expect.stringContaining('value'),
    })
  })

  test('validation only — extra keys the schema does not declare are kept, not stripped', async () => {
    const tool = defineTool({
      name: 'extra',
      description: 'Returns more than it declares.',
      parameters: z.object({}),
      output: z.object({ declared: z.number() }),
      handler: async () => ({ declared: 1, undeclared: 'kept' }),
    })
    const result = await executeToolCall(single(tool), tool, {})
    expect(result).toEqual({ declared: 1, undeclared: 'kept' })
  })

  test('tools without an output schema are unaffected', async () => {
    const result = await executeToolCall(multi(), readTool, {})
    expect(result).toEqual({ network: 'localnet' })
  })
})
