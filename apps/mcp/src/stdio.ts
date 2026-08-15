/** The reference stdio deployment — this file IS the self-hosting documentation. */
import { serveVibekitStdio } from '@initlabs/vibekit-mcp/stdio'
import { createKeystoreSigner } from '@initlabs/vibekit-signer-keystore'
import type { NetworkId } from '@initlabs/vibekit-core'
import { tools } from './tools.js'

// SIGNING=execute signs via the local keystore daemon (`keystore serve`).
// Default is compose: write tools return unsigned txns for external signing.
const mode = process.env.SIGNING === 'execute' ? 'execute' : 'compose'
const signer = mode === 'execute' ? await createKeystoreSigner() : undefined

const handle = serveVibekitStdio({
  name: 'vibekit-reference',
  network: (process.env.NETWORK as NetworkId) ?? 'testnet',
  // e.g. NETWORKS=testnet,localnet — multi-network per-request selection (§10)
  networks: (process.env.NETWORKS?.split(',') as NetworkId[]) ?? [],
  mode,
  tools,
  resolveSigner: signer ? (address) => signer.resolveSigner(address) : undefined,
})

console.error(`vibekit mcp (stdio) up — mode=${mode}`)
process.on('SIGINT', () => {
  void handle.close()
  void signer?.close()
})
