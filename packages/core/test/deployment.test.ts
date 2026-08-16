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
