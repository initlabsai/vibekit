/**
 * The signer seam: `resolveSigner` takes any algosdk TransactionSigner. The
 * keystore daemon is one (see stdio.ts); this one is a mnemonic in an env
 * var, and in a browser it is use-wallet's `transactionSigner` unchanged:
 *
 *   resolveSigner: async () => useWallet().transactionSigner
 *
 * Run: MNEMONIC="..." bun packages/vibekit/examples/signer.ts
 */
import algosdk from 'algosdk'
import { createVibekitHttpHandler } from '@initlabs/vibekit/mcp/http'
import { defaultTools } from '@initlabs/vibekit/preset'

const account = algosdk.mnemonicToSecretKey(process.env.MNEMONIC ?? '')
const signer = algosdk.makeBasicAccountTransactionSigner(account)

const handler = createVibekitHttpHandler({
  name: 'vibekit-signer-example',
  network: 'testnet',
  mode: 'execute',
  tools: defaultTools,
  // Only this account may sign: the contract is (address) => signer.
  resolveSigner: async (address) => {
    if (address !== account.addr.toString()) throw new Error(`no signer for ${address}`)
    return signer
  },
})

const port = Number(process.env.PORT ?? 8788)
Bun.serve({ port, fetch: (request) => handler.fetch(request) })
console.error(`vibekit mcp (http, execute as ${account.addr}) on :${port}`)
