/**
 * The light consumer: only algosdk and zod installed, no optional peer. A
 * green run proves that importing the contract, the tools, and the view
 * schemas pulls in none of the agent, MCP, keystore, or plugin SDKs.
 */
import {
  defineTool,
  executeToolCall,
  resolveDeployment,
  type ToolDefinition,
} from '@initlabs/vibekit'
import { accountTools, viewDataSchemas, type ViewData } from '@initlabs/vibekit/tools'
import { viewDataSchemas as fromSubpath } from '@initlabs/vibekit/tools/views'
import { z } from 'zod'

function fail(message: string): never {
  console.error(`packed-consumer-light: ${message}`)
  process.exit(1)
}

type Detail = ViewData<'transaction.detail'>
const _types: ['id' extends keyof Detail ? true : never, ToolDefinition | null] = [true, null]
void _types
if (fromSubpath !== viewDataSchemas) fail('tools/views does not re-serve viewDataSchemas')

const echo = defineTool({
  name: 'echo',
  description: 'Echo a value.',
  parameters: z.object({ value: z.string() }),
  handler: async (_ctx, args) => ({ value: args.value }),
})
const deployment = resolveDeployment({
  network: 'localnet',
  mode: 'compose',
  tools: [echo, ...accountTools],
})
const result = (await executeToolCall(deployment, echo, { value: 'hi' })) as { value: string }
if (result.value !== 'hi') fail(`executeToolCall returned ${JSON.stringify(result)}`)

// The proof: none of the optional peers resolve from here.
for (const name of ['ai', '@modelcontextprotocol/server', '@algorandfoundation/keystore-node']) {
  try {
    await import(name)
    fail(`${name} is installed in the light consumer; an optional peer leaked into dependencies`)
  } catch (error) {
    if (!(error instanceof Error) || !/Cannot find|not found|resolve/i.test(error.message))
      throw error
  }
}

console.log('packed-consumer-light: ok')
