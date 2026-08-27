/**
 * `vibekit mcp` — the local MCP server over stdio, importing
 * @initlabs/vibekit/mcp as a library (no app→app dependency).
 *
 * Config via env (set by `vibekit init` in agent MCP configs):
 *   NETWORK   default network id (default: localnet)
 *   NETWORKS  comma-separated served networks (default: localnet,testnet,mainnet)
 *   SIGNING   'execute' (keystore daemon) or 'compose' (unsigned groups out)
 */

import { serveVibekitStdio } from '@initlabs/vibekit/mcp/stdio'
import {
  defaultPlugins,
  defaultTools,
  networksFromEnv,
  withKeystoreTools,
} from '@initlabs/vibekit/preset'
import { createKeystoreSigner, type KeystoreSigner } from '@initlabs/vibekit/signer-keystore'

export async function commandMcp(): Promise<void> {
  const requestedMode = process.env.SIGNING === 'compose' ? 'compose' : 'execute'

  // Execute mode needs the keystore daemon; fall back to compose (with a
  // loud stderr warning) so the agent still gets an MCP when it's down.
  let signer: KeystoreSigner | undefined
  let mode: 'execute' | 'compose' = requestedMode
  if (requestedMode === 'execute') {
    // Same background daemon `vibekit explore` starts; nobody keeps a terminal open for it.
    const { ensureKeystoreDaemon } = await import('./keystore.js')
    await ensureKeystoreDaemon()
    try {
      signer = await createKeystoreSigner()
    } catch {
      mode = 'compose'
      console.error(
        'vibekit mcp: keystore daemon not reachable — starting in compose mode ' +
          '(write tools return unsigned transactions). Run `vibekit keystore start` and restart for signing.',
      )
    }
  }

  const handle = serveVibekitStdio({
    name: 'vibekit',
    ...networksFromEnv({ network: 'localnet', networks: ['localnet', 'testnet', 'mainnet'] }),
    mode,
    // With a signer, agents can also discover/create local accounts;
    // with a dispenser token, they can fund testnet too.
    tools: await withKeystoreTools(defaultTools, signer),
    plugins: defaultPlugins(),
    resolveSigner: signer ? (address) => signer.resolveSigner(address) : undefined,
  })

  console.error(`vibekit mcp (stdio) up — mode=${mode}`)
  process.on('SIGINT', () => {
    void handle.close()
    void signer?.close()
  })
}
