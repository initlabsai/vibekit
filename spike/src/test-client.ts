/** Smoke-test client: spawn the stdio server, list tools, call the reads (verdict c). */
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

const client = new Client({ name: 'spike-test-client', version: '0.0.0' })
const transport = new StdioClientTransport({
  command: 'bun',
  args: ['run', 'src/stdio.ts'],
  env: { ...process.env, NETWORK: 'testnet', SIGNING: 'compose' },
})

await client.connect(transport)
console.log('server:', JSON.stringify(client.getServerVersion()))

const tools = await client.listTools()
console.log(
  'tools:',
  tools.tools.map((t) => `${t.name}${t.annotations?.readOnlyHint ? ' [ro]' : ''}`).join(', '),
)

const status = await client.callTool({ name: 'get_network_status', arguments: {} })
console.log('get_network_status:', JSON.stringify(status.content))

const account = await client.callTool({
  name: 'get_account_info',
  arguments: { address: 'Y76M3MSY6DKBRHBL7C3NNDXGS5IIMQVQVUAB6MP4XEMMGVF2QWNPL226CA' },
})
console.log('get_account_info:', JSON.stringify(account.content))

const compose = await client.callTool({
  name: 'send_payment',
  arguments: {
    sender: 'Y76M3MSY6DKBRHBL7C3NNDXGS5IIMQVQVUAB6MP4XEMMGVF2QWNPL226CA',
    receiver: 'Y76M3MSY6DKBRHBL7C3NNDXGS5IIMQVQVUAB6MP4XEMMGVF2QWNPL226CA',
    amountMicroAlgos: 1000,
  },
})
console.log('send_payment (compose):', JSON.stringify(compose.content).slice(0, 400))

await client.close()
