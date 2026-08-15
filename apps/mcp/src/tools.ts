/** Placeholder tool until @initlabs/tools-* land in Phase 2. */
import { defineTool, type AnyTool } from '@initlabs/core'
import { z } from 'zod'

export const ping = defineTool({
  name: 'ping',
  description: 'Liveness check: returns pong, the network, and the current round.',
  parameters: z.object({}),
  display: 'json',
  handler: async (ctx) => {
    const status = await ctx.algod.status().do()
    return { pong: true, network: ctx.network.id, lastRound: status.lastRound }
  },
}) as AnyTool

export const tools: AnyTool[] = [ping]
