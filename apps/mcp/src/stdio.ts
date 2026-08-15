/** The reference stdio deployment — this file IS the self-hosting documentation. */
import { serveVibekitStdio } from '@initlabs/mcp/stdio'
import type { NetworkId } from '@initlabs/core'
import { tools } from './tools.js'

const handle = serveVibekitStdio({
  name: 'vibekit-reference',
  network: (process.env.NETWORK as NetworkId) ?? 'testnet',
  mode: 'compose', // execute mode needs a signer — see @initlabs/signer-keystore (Phase 3)
  tools,
})

console.error('vibekit mcp (stdio) up')
process.on('SIGINT', () => void handle.close())
