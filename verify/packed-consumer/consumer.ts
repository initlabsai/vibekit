/**
 * The packed-package consumer. Installed from tarballs outside the
 * workspace, so a green run proves the published edge: exports resolve,
 * types compile, and the runtime imports load without workspace resolution.
 * No network calls — this verifies packaging, not behavior.
 */
import {
  defineTool,
  executeToolCall,
  resolveDeployment,
  ToolError,
  type ToolPlugin,
} from '@initlabs/vibekit-core'
import {
  accountTools,
  networkTools,
  transactionTools,
  viewDataSchemas,
  type FormattedTransaction,
  type ViewData,
} from '@initlabs/vibekit-tools'
import { viewDataSchemas as viewSchemasFromSubpath } from '@initlabs/vibekit-tools/views'
import { createVibekitMcp, VIEW_META_KEY } from '@initlabs/vibekit-mcp'
import type { AgentEvent, ProviderConfig } from '@initlabs/vibekit-agent'
import { createSignerFromKeystore, type KeystoreLike } from '@initlabs/vibekit-signer-keystore'
import { nfdPlugin } from '@initlabs/vibekit-plugin-nfd'
import { peraPlugin } from '@initlabs/vibekit-plugin-pera'
import { vestigePlugin } from '@initlabs/vibekit-plugin-vestige'
import { defaultPlugins, defaultTools } from '@initlabs/vibekit-preset'
import { alphaArcadePlugin } from '@initlabs/vibekit-plugin-alpha-arcade'
import { z } from 'zod'

function fail(message: string): never {
  console.error(`packed-consumer: ${message}`)
  process.exit(1)
}

// Type-level checks: these compile only if the published types are intact.
type TxnDetail = ViewData<'transaction.detail'>
const _typeChecks: ['id' extends keyof TxnDetail ? true : never, FormattedTransaction | null, AgentEvent | null, KeystoreLike | null, ToolPlugin[]] = [
  true,
  null,
  null,
  null,
  [nfdPlugin(), alphaArcadePlugin(), vestigePlugin(), peraPlugin()],
]
void _typeChecks
void createSignerFromKeystore

const providerConfig: ProviderConfig = { provider: 'ollama', model: 'qwen3' }
void providerConfig

if (defaultTools.length === 0 || defaultPlugins().length !== 4) {
  fail('the preset default set is incomplete')
}

if (typeof viewDataSchemas['transaction.detail']?.parse !== 'function') {
  fail('viewDataSchemas is missing transaction.detail')
}
// The ./views subpath must serve the same object as the root export.
if (viewSchemasFromSubpath !== viewDataSchemas) {
  fail('@initlabs/vibekit-tools/views does not re-serve the root viewDataSchemas object')
}

const echo = defineTool({
  name: 'echo',
  description: 'Echo back a value with a bigint, exercising jsonSafe.',
  parameters: z.object({ value: z.string() }),
  output: z.object({ value: z.string(), big: z.number() }),
  handler: async (_ctx, args) => ({ value: args.value, big: 7n }),
})

const deployment = resolveDeployment({
  network: 'localnet',
  mode: 'compose',
  tools: [echo, ...accountTools, ...networkTools, ...transactionTools],
})
if (!deployment.contexts.get('localnet')) fail('resolveDeployment produced no localnet context')

const result = (await executeToolCall(deployment, echo, { value: 'hi' })) as { big: number }
if (result.big !== 7) fail(`executeToolCall returned ${JSON.stringify(result)}`)

const server = createVibekitMcp({ network: 'localnet', mode: 'compose', tools: [echo] })
if (!server || typeof VIEW_META_KEY !== 'string') fail('createVibekitMcp did not construct')

void ToolError

console.log('packed-consumer: ok')
