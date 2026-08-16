/**
 * `vibekit tool` — the full tool surface as CLI subcommands. The third thin
 * host over the same engine (MCP adapter, agent orchestrator, this): one
 * generic adapter, zero per-tool code. Gives agents a correct shell fallback
 * when no MCP client is available, and humans a scriptable interface.
 *
 *   vibekit tool list
 *   vibekit tool <name> --help
 *   vibekit tool <name> '<json-args>'
 *
 * Env mirrors `vibekit mcp`: NETWORK, NETWORKS, SIGNING=execute|compose.
 */

import pc from 'picocolors'
import { z } from 'zod'

import {
  executeToolCall,
  injectNetworkParam,
  resolveDeployment,
  ToolError,
  type AnyTool,
  type NetworkId,
  type ResolvedDeployment,
} from '@initlabs/vibekit-core'
import {
  createKeystoreSigner,
  createSigningAccountTool,
  createSigningAddressesTool,
  type KeystoreSigner,
} from '@initlabs/vibekit-signer-keystore'
import { alphaArcadePlugin } from '@initlabs/vibekit-plugin-alpha-arcade'
import { nfdPlugin } from '@initlabs/vibekit-plugin-nfd'
import { accountTools } from '@initlabs/vibekit-tools-accounts'
import { assetTools, assetWriteTools } from '@initlabs/vibekit-tools-assets'
import { contractTools, contractWriteTools } from '@initlabs/vibekit-tools-contracts'
import { networkTools } from '@initlabs/vibekit-tools-network'
import { transactionTools, transactionWriteTools } from '@initlabs/vibekit-tools-transactions'

const baseTools: AnyTool[] = [
  ...networkTools,
  ...accountTools,
  ...assetTools,
  ...transactionTools,
  ...contractTools,
  ...transactionWriteTools,
  ...assetWriteTools,
  ...contractWriteTools,
]

async function buildDeployment(): Promise<{
  deployment: ResolvedDeployment
  signer: KeystoreSigner | undefined
}> {
  let signer: KeystoreSigner | undefined
  if (process.env.SIGNING !== 'compose') {
    try {
      signer = await createKeystoreSigner()
    } catch {
      // daemon down — read/compose still works
    }
  }

  const deployment = resolveDeployment({
    network: (process.env.NETWORK as NetworkId) ?? 'localnet',
    networks: (process.env.NETWORKS?.split(',') as NetworkId[]) ?? [
      'localnet',
      'testnet',
      'mainnet',
    ],
    mode: signer ? 'execute' : 'compose',
    tools: signer
      ? [...baseTools, createSigningAddressesTool(signer), createSigningAccountTool(signer)]
      : baseTools,
    plugins: [nfdPlugin(), alphaArcadePlugin()],
    resolveSigner: signer ? (address) => signer.resolveSigner(address) : undefined,
  })

  return { deployment, signer }
}

export async function commandTool(args: string[]): Promise<void> {
  const [name, ...rest] = args
  const { deployment, signer } = await buildDeployment()

  try {
    if (!name || name === 'list' || name === '--help' || name === '-h') {
      console.log(pc.bold('vibekit tool <name> [json-args] — call any VibeKit tool from the shell\n'))
      for (const tool of deployment.tools) {
        console.log(`  ${pc.cyan(tool.name.padEnd(28))} ${tool.description.split('.')[0]}`)
      }
      console.log(
        pc.dim(
          `\nDetails: vibekit tool <name> --help · args as one JSON string, e.g.\n  vibekit tool lookup_account '{"address":"...","network":"mainnet"}'`,
        ),
      )
      return
    }

    const tool = deployment.tools.find((t) => t.name === name)
    if (!tool) {
      console.error(pc.red(`Unknown tool: ${name}`) + pc.dim(' — see `vibekit tool list`'))
      process.exitCode = 1
      return
    }

    if (rest.includes('--help') || rest.includes('-h')) {
      console.log(`${pc.bold(tool.name)} — ${tool.description}\n`)
      console.log(pc.dim('Parameters (JSON Schema):'))
      console.log(JSON.stringify(z.toJSONSchema(injectNetworkParam(tool, deployment)), null, 2))
      return
    }

    const rawArgs = rest.find((a) => !a.startsWith('-')) ?? '{}'
    let parsed: unknown
    try {
      parsed = JSON.parse(rawArgs)
    } catch {
      console.error(pc.red(`Arguments must be one JSON object string, got: ${rawArgs}`))
      process.exitCode = 1
      return
    }

    const schema = injectNetworkParam(tool, deployment)
    const validated = schema.safeParse(parsed)
    if (!validated.success) {
      console.error(pc.red(`Invalid arguments for ${tool.name}:`))
      console.error(JSON.stringify(validated.error.issues, null, 2))
      process.exitCode = 1
      return
    }

    const result = await executeToolCall(deployment, tool, validated.data)
    console.log(JSON.stringify(result, null, 2))
  } catch (err) {
    if (err instanceof ToolError) {
      console.error(pc.red(`${err.code}: ${err.message}`))
    } else {
      console.error(pc.red(err instanceof Error ? err.message : String(err)))
    }
    process.exitCode = 1
  } finally {
    await signer?.close()
  }
}
