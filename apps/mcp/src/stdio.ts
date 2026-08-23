/** The reference stdio deployment — this file IS the self-hosting documentation. */
import { serveVibekitStdio } from '@initlabs/vibekit-mcp/stdio'
import { alphaArcadePlugin } from '@initlabs/vibekit-plugin-alpha-arcade'
import { nfdPlugin } from '@initlabs/vibekit-plugin-nfd'
import { peraPlugin } from '@initlabs/vibekit-plugin-pera'
import { vestigePlugin } from '@initlabs/vibekit-plugin-vestige'
import { createFundTestnetTool, createKeystoreSigner, createSigningAccountTool, createSigningAddressesTool, hasDispenserToken } from '@initlabs/vibekit-signer-keystore'
import type { NetworkId } from '@initlabs/vibekit-core'
import { tools } from './tools.js'

// SIGNING=execute signs via the local keystore daemon (`keystore serve`).
// Default is compose: write tools return unsigned txns for external signing.
const mode = process.env.SIGNING === 'execute' ? 'execute' : 'compose'
const signer = mode === 'execute' ? await createKeystoreSigner() : undefined

const handle = serveVibekitStdio({
  name: 'vibekit-reference',
  network: (process.env.NETWORK as NetworkId) ?? 'testnet',
  // e.g. NETWORKS=testnet,localnet for per-request network selection
  networks: (process.env.NETWORKS?.split(',').map((n) => n.trim()).filter(Boolean) as NetworkId[]) ?? [],
  mode,
  // signer present → keystore account tools; dispenser token → testnet funding
  tools: signer
    ? [
        ...tools,
        createSigningAddressesTool(signer),
        createSigningAccountTool(signer),
        ...(signer.secrets && (await hasDispenserToken(signer.secrets))
          ? [createFundTestnetTool(signer.secrets)]
          : []),
      ]
    : tools,
  plugins: [nfdPlugin(), alphaArcadePlugin(), vestigePlugin(), peraPlugin()],
  resolveSigner: signer ? (address) => signer.resolveSigner(address) : undefined,
})

console.error(`vibekit mcp (stdio) up — mode=${mode}`)
process.on('SIGINT', () => {
  void handle.close()
  void signer?.close()
})
