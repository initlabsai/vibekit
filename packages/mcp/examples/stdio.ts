/**
 * The reference stdio deployment — copy this file to start your own server.
 * Typechecked by this package's `typecheck` script so it cannot rot; run it
 * with `bun packages/mcp/examples/stdio.ts` from the repo root.
 */
import { serveVibekitStdio } from '@initlabs/vibekit-mcp/stdio'
import { defaultPlugins, defaultTools, networksFromEnv, withKeystoreTools } from '@initlabs/vibekit-preset'
import { createKeystoreSigner } from '@initlabs/vibekit-signer-keystore'

// SIGNING=execute signs via the local keystore daemon (`keystore serve`).
// Default is compose: write tools return unsigned txns for external signing.
const mode = process.env.SIGNING === 'execute' ? 'execute' : 'compose'
const signer = mode === 'execute' ? await createKeystoreSigner() : undefined

const handle = serveVibekitStdio({
  name: 'vibekit-reference',
  // e.g. NETWORKS=testnet,localnet for per-request network selection
  ...networksFromEnv({ network: 'testnet', networks: [] }),
  mode,
  // signer present → keystore account tools; dispenser token → testnet funding
  tools: await withKeystoreTools(defaultTools, signer),
  plugins: defaultPlugins(),
  resolveSigner: signer ? (address) => signer.resolveSigner(address) : undefined,
})

console.error(`vibekit mcp (stdio) up — mode=${mode}`)
process.on('SIGINT', () => {
  void handle.close()
  void signer?.close()
})
