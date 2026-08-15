/**
 * E2E: MCP client → stateless stdio server (execute mode) → send_payment
 * → keystore daemon signs over the socket → localnet confirms.
 */
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

const SPIKE_ADDRESS = 'H2V73DQUGGGMHXZI5D4PNSPYW4FYBDNOTVI5MCPOQHPUDLVMNOYVOYLRXM'
const RECEIVER = 'OXNTQ2K3DTDMQVKV2PWQW6AYMSVZHEWJ6EPSUONVCZECIOAVPNNHIHVN3Y'

const client = new Client({ name: 'spike-e2e', version: '0.0.0' })
await client.connect(
  new StdioClientTransport({
    command: 'bun',
    args: ['run', 'src/stdio.ts'],
    env: { ...process.env, NETWORK: process.env.NETWORK ?? 'localnet', SIGNING: 'execute' },
  }),
)

const before = await client.callTool({
  name: 'get_account_info',
  arguments: { address: SPIKE_ADDRESS },
})
console.log('before:', (before.content as Array<{ text: string }>)[0]?.text)

const payment = await client.callTool({
  name: 'send_payment',
  arguments: {
    sender: SPIKE_ADDRESS,
    receiver: RECEIVER,
    amountMicroAlgos: 1_000_000,
    note: 'vibekit v2 spike: keystore-signed via stateless MCP',
  },
})
console.log('send_payment:', (payment.content as Array<{ text: string }>)[0]?.text)
console.log('isError:', payment.isError ?? false)

const after = await client.callTool({
  name: 'get_account_info',
  arguments: { address: SPIKE_ADDRESS },
})
console.log('after:', (after.content as Array<{ text: string }>)[0]?.text)

await client.close()
