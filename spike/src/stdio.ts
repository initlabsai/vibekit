/** stdio entry: NETWORK + SIGNING env config, keystore signing in execute mode. */
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { createSpikeMcp } from './server'
import { spikeTools } from './tools'
import { resolveKeystoreSigner } from './keystore-signer'
import type { NetworkId } from './contract'

const network = (process.env.NETWORK ?? 'testnet') as NetworkId
const mode = process.env.SIGNING === 'compose' ? 'compose' : 'execute'

const handle = serveStdio(() =>
  createSpikeMcp({
    network,
    mode,
    tools: spikeTools,
    resolveSigner: mode === 'execute' ? resolveKeystoreSigner : undefined,
  }),
)

console.error(`vibekit-spike stdio: network=${network} mode=${mode}`)
process.on('SIGINT', () => void handle.close())
