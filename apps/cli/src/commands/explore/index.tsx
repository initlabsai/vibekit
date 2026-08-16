/**
 * `vibekit explore` — the agent-native Lora: English-language questions about
 * the network in a component TUI (Ink). Runs @initlabs/vibekit-agent
 * in-process with the tool packages imported directly — no MCP hop, no hosted
 * dependency. With the keystore daemon running, the user can "connect" an
 * account and act: write tools execute behind an approval card.
 *
 * This entry does no terminal UI of its own — every prompt (model wizard,
 * account picker, chat) is an Ink component, because mixing prompt libraries
 * leaves stdin in a state Ink can't recover from.
 */

import React from 'react'
import { render } from 'ink'

import { createAgent, type ProviderConfig } from '@initlabs/vibekit-agent'
import type { AnyTool, NetworkId } from '@initlabs/vibekit-core'
import { createKeystoreSigner, type KeystoreSigner } from '@initlabs/vibekit-signer-keystore'
import { accountTools } from '@initlabs/vibekit-tools-accounts'
import { assetTools, assetWriteTools } from '@initlabs/vibekit-tools-assets'
import { contractTools, contractWriteTools } from '@initlabs/vibekit-tools-contracts'
import { networkTools } from '@initlabs/vibekit-tools-network'
import { transactionTools, transactionWriteTools } from '@initlabs/vibekit-tools-transactions'
import { alphaArcadePlugin } from '@initlabs/vibekit-plugin-alpha-arcade'
import { nfdPlugin } from '@initlabs/vibekit-plugin-nfd'

import { loadUserConfig, saveUserConfig, userConfigPath } from '../../config/user-config.js'
import { ExploreRoot, type ApprovalBridge } from './app.js'

const NETWORK_IDS: NetworkId[] = ['mainnet', 'testnet', 'localnet']

const readTools: AnyTool[] = [
  ...networkTools,
  ...accountTools,
  ...assetTools,
  ...transactionTools,
  ...contractTools,
]

const writeTools: AnyTool[] = [
  ...transactionWriteTools,
  ...assetWriteTools,
  ...contractWriteTools,
]

/** Detect the keystore daemon and its address book — no UI, just facts. */
async function detectKeystore(): Promise<{ signer: KeystoreSigner; addresses: string[] } | null> {
  let signer: KeystoreSigner
  try {
    signer = await createKeystoreSigner()
  } catch {
    return null // daemon not running — read-only session
  }
  try {
    const addresses = await signer.listAddresses()
    if (addresses.length === 0) {
      await signer.close()
      return null
    }
    return { signer, addresses }
  } catch {
    await signer.close()
    return null
  }
}

function parseNetwork(args: string[]): NetworkId | undefined {
  const index = args.indexOf('--network')
  const value =
    index !== -1 ? args[index + 1] : args.find((a) => a.startsWith('--network='))?.split('=')[1]
  if (value === undefined) return undefined
  if (!NETWORK_IDS.includes(value as NetworkId)) {
    console.error(`Unknown network '${value}'. Available: ${NETWORK_IDS.join(', ')}`)
    process.exit(1)
  }
  return value as NetworkId
}

export async function commandExplore(args: string[]): Promise<void> {
  const config = loadUserConfig()
  const defaultNetwork = parseNetwork(args) ?? config.defaultNetwork ?? 'mainnet'
  const keystore = await detectKeystore()
  const approvalBridge: ApprovalBridge = {}

  const createSession = (model: ProviderConfig, signingAddress: string | null) => {
    const connected = keystore !== null && signingAddress !== null

    const renderedResultsNote =
      'Tool results are rendered to the user in full as cards the moment they arrive. Never repeat their contents (no re-listing fields, no re-tabulating data) — give the direct answer, interpretation, or next steps instead.'
    const connectedNote = connected
      ? `\nThe user's connected account is ${signingAddress}. When they say "my account" or ask to act without naming a sender, use it as the sender. Every write is shown to the user for approval before it executes.`
      : '\nThis session is read-only: no signer is connected, so write tools are unavailable.'

    return createAgent({
      model,
      network: defaultNetwork,
      networks: NETWORK_IDS,
      mode: connected ? 'execute' : 'compose',
      tools: connected ? [...readTools, ...writeTools] : readTools,
      plugins: [nfdPlugin(), alphaArcadePlugin()],
      resolveSigner: connected ? (address) => keystore.signer.resolveSigner(address) : undefined,
      approveToolCall: connected
        ? (call) => (approvalBridge.request ? approvalBridge.request(call) : Promise.resolve(false))
        : undefined,
      extraInstructions: renderedResultsNote + connectedNote,
    })
  }

  const app = render(
    <ExploreRoot
      configPath={userConfigPath()}
      initialModel={config.model}
      addresses={keystore?.addresses ?? []}
      networks={NETWORK_IDS}
      defaultNetwork={defaultNetwork}
      saveModel={async (model) => {
        await saveUserConfig({ ...loadUserConfig(), model })
      }}
      createSession={createSession}
      approvalBridge={approvalBridge}
    />,
  )

  await app.waitUntilExit()
  await keystore?.signer.close()
}
