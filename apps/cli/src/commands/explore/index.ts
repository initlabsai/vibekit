/**
 * `vibekit explore` — the agent-native Lora: English-language questions about
 * the network in a TUI. Runs @initlabs/vibekit-agent in-process with the read
 * tool packages imported directly — no MCP hop, no hosted dependency.
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { createInterface } from 'node:readline/promises'

import { createAgent, type AgentSession, type ProviderConfig } from '@initlabs/vibekit-agent'
import type { AnyTool, NetworkId } from '@initlabs/vibekit-core'
import { accountTools } from '@initlabs/vibekit-tools-accounts'
import { assetTools } from '@initlabs/vibekit-tools-assets'
import { contractTools } from '@initlabs/vibekit-tools-contracts'
import { networkTools } from '@initlabs/vibekit-tools-network'
import { transactionTools } from '@initlabs/vibekit-tools-transactions'
import { alphaArcadePlugin } from '@initlabs/vibekit-plugin-alpha-arcade'
import { nfdPlugin } from '@initlabs/vibekit-plugin-nfd'

import { loadUserConfig, saveUserConfig, userConfigPath } from '../../config/user-config.js'
import { select, text } from '../../utils/prompts.js'
import { renderToolResult } from './render.js'

const NETWORK_IDS: NetworkId[] = ['mainnet', 'testnet', 'localnet']

// Explore = look: the read surface only. Write tools stay in the MCP/keystore path.
const readTools: AnyTool[] = [
  ...networkTools,
  ...accountTools,
  ...assetTools,
  ...transactionTools,
  ...contractTools,
]

const MODEL_PLACEHOLDERS: Record<ProviderConfig['provider'], string> = {
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-5',
  ollama: 'qwen3:8b',
  'openai-compatible': 'model id',
}

/** First-run BYOM setup — persisted to the CLI config file. */
async function modelSetupWizard(): Promise<ProviderConfig> {
  p.log.info(`No model configured yet (config: ${pc.dim(userConfigPath())})`)

  const provider = (await select({
    message: 'Which model provider?',
    options: [
      { value: 'anthropic', label: 'Anthropic', hint: 'API key (or ANTHROPIC_API_KEY)' },
      { value: 'openai', label: 'OpenAI', hint: 'API key (or OPENAI_API_KEY)' },
      { value: 'ollama', label: 'Ollama', hint: 'local models, no key needed' },
      { value: 'openai-compatible', label: 'OpenAI-compatible endpoint', hint: 'custom baseUrl' },
    ],
  })) as ProviderConfig['provider']

  const model = await text({
    message: 'Model id:',
    placeholder: MODEL_PLACEHOLDERS[provider],
    defaultValue: MODEL_PLACEHOLDERS[provider],
  })

  const config: ProviderConfig = { provider, model }

  if (provider === 'openai-compatible' || provider === 'ollama') {
    const baseUrl = await text({
      message: 'Base URL:',
      placeholder: provider === 'ollama' ? 'http://localhost:11434/v1' : 'https://…/v1',
      defaultValue: provider === 'ollama' ? 'http://localhost:11434/v1' : '',
    })
    if (baseUrl) config.baseUrl = baseUrl
  }

  if (provider === 'anthropic' || provider === 'openai' || provider === 'openai-compatible') {
    const apiKey = await text({
      message: 'API key (leave empty to use the environment variable):',
      defaultValue: '',
    })
    if (apiKey.trim()) config.apiKey = apiKey.trim()
  }

  const existing = loadUserConfig()
  await saveUserConfig({ ...existing, model: config })
  p.log.success(`Saved to ${userConfigPath()}`)
  return config
}

function parseNetwork(args: string[]): NetworkId | undefined {
  const index = args.indexOf('--network')
  const value = index !== -1 ? args[index + 1] : args.find((a) => a.startsWith('--network='))?.split('=')[1]
  if (value === undefined) return undefined
  if (!NETWORK_IDS.includes(value as NetworkId)) {
    p.log.error(`Unknown network '${value}'. Available: ${NETWORK_IDS.join(', ')}`)
    process.exit(1)
  }
  return value as NetworkId
}

function compactArgs(input: unknown): string {
  const json = JSON.stringify(input) ?? ''
  return json.length > 100 ? json.slice(0, 99) + '…' : json
}

function indent(block: string, prefix: string): string {
  return block
    .split('\n')
    .map((line) => prefix + line)
    .join('\n')
}

async function runTurn(agent: AgentSession, input: string): Promise<void> {
  let inText = false
  const endText = () => {
    if (inText) {
      process.stdout.write('\n')
      inText = false
    }
  }

  for await (const event of agent.stream(input)) {
    switch (event.type) {
      case 'text-delta':
        inText = true
        process.stdout.write(event.text)
        break
      case 'tool-call':
        endText()
        console.log(pc.dim(`⚙ ${event.toolName}(${compactArgs(event.input)})`))
        break
      case 'tool-result': {
        endText()
        if (event.isError) {
          const error = (event.output as { error?: { code?: string; message?: string } }).error
          console.log(pc.red(`  ✗ ${error?.code ?? 'ERROR'}: ${error?.message ?? 'tool failed'}`))
        } else {
          console.log(pc.dim(indent(renderToolResult(event.output, event.display), '  ')))
        }
        break
      }
      case 'error':
        endText()
        console.log(pc.red(`error: ${event.message}`))
        break
      case 'finish':
        endText()
        break
      default:
        break
    }
  }
}

export async function commandExplore(args: string[]): Promise<void> {
  const config = loadUserConfig()
  const model = config.model ?? (await modelSetupWizard())
  const defaultNetwork = parseNetwork(args) ?? config.defaultNetwork ?? 'mainnet'

  const agent = createAgent({
    model,
    network: defaultNetwork,
    networks: NETWORK_IDS,
    mode: 'compose',
    tools: readTools,
    plugins: [nfdPlugin(), alphaArcadePlugin()],
  })

  console.log(
    [
      '',
      `${pc.bold(pc.cyan('vibekit explore'))} — ask about the Algorand network in plain English.`,
      pc.dim(
        `model ${model.provider}/${model.model} · networks ${NETWORK_IDS.join(', ')} (default ${defaultNetwork})`,
      ),
      pc.dim('/new resets the conversation · /exit quits'),
      '',
    ].join('\n'),
  )

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  rl.on('SIGINT', () => {
    rl.close()
    console.log()
    process.exit(0)
  })

  for (;;) {
    let line: string
    try {
      line = (await rl.question(pc.cyan('❯ '))).trim()
    } catch {
      break // stdin closed (Ctrl-D)
    }

    if (line === '') continue
    if (line === '/exit' || line === '/quit') break
    if (line === '/new') {
      agent.reset()
      console.log(pc.dim('(conversation reset)\n'))
      continue
    }
    if (line === '/help') {
      console.log(pc.dim('Ask anything about Algorand. /new resets, /exit quits.\n'))
      continue
    }

    try {
      await runTurn(agent, line)
    } catch (error) {
      console.log(pc.red(error instanceof Error ? error.message : String(error)))
    }
    console.log()
  }

  rl.close()
}
