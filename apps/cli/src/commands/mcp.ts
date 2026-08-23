/**
 * `vibekit mcp` — the local MCP server over stdio, importing
 * @initlabs/vibekit-mcp as a library (no app→app dependency).
 *
 * Config via env (set by `vibekit init` in agent MCP configs):
 *   NETWORK   default network id (default: localnet)
 *   NETWORKS  comma-separated served networks (default: localnet,testnet,mainnet)
 *   SIGNING   'execute' (keystore daemon) or 'compose' (unsigned groups out)
 */

import { serveVibekitStdio } from '@initlabs/vibekit-mcp/stdio'
import {
  createFundTestnetTool,
  createKeystoreSigner,
  createSigningAccountTool,
  createSigningAddressesTool,
  hasDispenserToken,
  type KeystoreSigner,
} from '@initlabs/vibekit-signer-keystore'
import { alphaArcadePlugin } from '@initlabs/vibekit-plugin-alpha-arcade'
import { nfdPlugin } from '@initlabs/vibekit-plugin-nfd'
import { peraPlugin } from '@initlabs/vibekit-plugin-pera'
import { vestigePlugin } from '@initlabs/vibekit-plugin-vestige'
import type { AnyTool, NetworkId } from '@initlabs/vibekit-core'
import {
  accountTools,
  assetTools,
  assetWriteTools,
  contractTools,
  contractWriteTools,
  networkTools,
  transactionTools,
  transactionWriteTools,
} from '@initlabs/vibekit-tools'

const tools: AnyTool[] = [
  ...networkTools,
  ...accountTools,
  ...assetTools,
  ...transactionTools,
  ...contractTools,
  ...transactionWriteTools,
  ...assetWriteTools,
  ...contractWriteTools,
]

export async function commandMcp(): Promise<void> {
  const requestedMode = process.env.SIGNING === 'compose' ? 'compose' : 'execute'

  // Execute mode needs the keystore daemon; fall back to compose (with a
  // loud stderr warning) so the agent still gets an MCP when it's down.
  let signer: KeystoreSigner | undefined
  let mode: 'execute' | 'compose' = requestedMode
  if (requestedMode === 'execute') {
    try {
      signer = await createKeystoreSigner()
    } catch {
      mode = 'compose'
      console.error(
        'vibekit mcp: keystore daemon not reachable — starting in compose mode ' +
          '(write tools return unsigned transactions). Run `keystore serve` and restart for signing.',
      )
    }
  }

  const handle = serveVibekitStdio({
    name: 'vibekit',
    network: (process.env.NETWORK as NetworkId) ?? 'localnet',
    networks: (process.env.NETWORKS?.split(',').map((n) => n.trim()).filter(Boolean) as NetworkId[]) ?? [
      'localnet',
      'testnet',
      'mainnet',
    ],
    mode,
    // With a signer, agents can also discover/create local accounts;
    // with a dispenser token, they can fund testnet too.
    tools: await withKeystoreTools(tools, signer),
    plugins: [nfdPlugin(), alphaArcadePlugin(), vestigePlugin(), peraPlugin()],
    resolveSigner: signer ? (address) => signer.resolveSigner(address) : undefined,
  })

  console.error(`vibekit mcp (stdio) up — mode=${mode}`)
  process.on('SIGINT', () => {
    void handle.close()
    void signer?.close()
  })
}

async function withKeystoreTools(
  base: AnyTool[],
  signer: KeystoreSigner | undefined,
): Promise<AnyTool[]> {
  if (!signer) return base
  const tools = [...base, createSigningAddressesTool(signer), createSigningAccountTool(signer)]
  if (signer.secrets && (await hasDispenserToken(signer.secrets))) {
    tools.push(createFundTestnetTool(signer.secrets))
  }
  return tools
}
