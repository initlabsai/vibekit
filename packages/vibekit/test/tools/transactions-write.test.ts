import { describe, expect, test } from 'bun:test'
import algosdk from 'algosdk'
import { base64ToBytes } from '../../src/core/index.js'
import { transactionWriteTools } from '../../src/tools/transactions/tools-write.js'
import { chainable, fakeContext } from './fake-context.js'

const ADDR_A = 'Y76M3MSY6DKBRHBL7C3NNDXGS5IIMQVQVUAB6MP4XEMMGVF2QWNPL226CA'
const ADDR_B = 'OXNTQ2K3DTDMQVKV2PWQW6AYMSVZHEWJ6EPSUONVCZECIOAVPNNHIHVN3Y'

const suggestedParams = {
  flatFee: false,
  fee: BigInt(0),
  minFee: BigInt(1000),
  firstValid: BigInt(1),
  lastValid: BigInt(1000),
  genesisID: 'x',
  genesisHash: new Uint8Array(32),
}

const ctx = () =>
  fakeContext({ algod: { getTransactionParams: () => chainable(suggestedParams) } })

describe('transaction write tools', () => {
  test('registry: 2 write + 1 simulate, writes require signer', () => {
    const names = transactionWriteTools.map((t) => t.name)
    expect(names).toEqual(['send_payment', 'send_group_transactions', 'simulate_transactions'])
    expect(transactionWriteTools.find((t) => t.name === 'send_payment')?.requiresSigner).toBe(true)
    expect(transactionWriteTools.find((t) => t.name === 'simulate_transactions')?.requiresSigner ?? false).toBe(false)
  })

  test('send_payment composes a decodable unsigned payment', async () => {
    const tool = transactionWriteTools.find((t) => t.name === 'send_payment')!
    const result = (await tool.handler(ctx(), {
      sender: ADDR_A,
      receiver: ADDR_B,
      amountMicroAlgos: 5000,
    } as never)) as { unsignedGroup: string[] }
    const txn = algosdk.decodeUnsignedTransaction(base64ToBytes(result.unsignedGroup[0]!))
    expect(txn.payment?.amount).toBe(BigInt(5000))
    expect(txn.sender.toString()).toBe(ADDR_A)
  })

  test('send_group_transactions composes a grouped pair', async () => {
    const tool = transactionWriteTools.find((t) => t.name === 'send_group_transactions')!
    const result = (await tool.handler(ctx(), {
      transactions: [
        { type: 'payment', sender: ADDR_A, receiver: ADDR_B, amountMicroAlgos: 1 },
        { type: 'asset_opt_in', sender: ADDR_B, assetId: 42 },
      ],
    } as never)) as { unsignedGroup: string[]; summary: string }
    expect(result.unsignedGroup).toHaveLength(2)
    expect(result.summary).toContain('[1] opt')
  })
})
