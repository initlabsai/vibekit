/**
 * Verdict (d): compose-mode round trip — the browser/hosted flow.
 * HTTP server (compose, no signer) returns unsignedGroup → this process
 * (playing the user's wallet) decodes, signs via keystore, submits directly.
 */
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import algosdk from 'algosdk'
import { resolveKeystoreSigner } from './keystore-signer'

const SPIKE_ADDRESS = 'H2V73DQUGGGMHXZI5D4PNSPYW4FYBDNOTVI5MCPOQHPUDLVMNOYVOYLRXM'
const RECEIVER = 'OXNTQ2K3DTDMQVKV2PWQW6AYMSVZHEWJ6EPSUONVCZECIOAVPNNHIHVN3Y'

const client = new Client({ name: 'compose-test', version: '0.0.0' })
await client.connect(new StreamableHTTPClientTransport(new URL('http://localhost:8788/')))

const result = await client.callTool({
  name: 'send_payment',
  arguments: { sender: SPIKE_ADDRESS, receiver: RECEIVER, amountMicroAlgos: 500_000 },
})
const text = (result.content as Array<{ text: string }>)[0]!.text
const { unsignedGroup, summary } = JSON.parse(text) as { unsignedGroup: string[]; summary: string }
console.log('server composed:', summary)

// "wallet side": decode, sign, submit
const txn = algosdk.decodeUnsignedTransaction(Buffer.from(unsignedGroup[0]!, 'base64'))
const signer = await resolveKeystoreSigner(SPIKE_ADDRESS)
const [signed] = await signer([txn], [0])

const algod = new algosdk.Algodv2('a'.repeat(64), 'http://localhost:4001')
const { txid } = await algod.sendRawTransaction(signed!).do()
const confirmed = await algosdk.waitForConfirmation(algod, txid, 4)
console.log('client-side signed & submitted:', txid, '→ round', confirmed.confirmedRound)

await client.close()
