import { describe, expect, test } from 'bun:test'
import algosdk from 'algosdk'
import nacl from 'tweetnacl'
import { createSignerFromKeystore } from '../src/index.js'

// A real ed25519 keypair so signatures verify end-to-end. The keystore daemon
// signs the raw bytes it is given (bytesToSign() already carries the TX prefix).
const account = algosdk.generateAccount()
const secretKey = account.sk
const publicKey = algosdk.decodeAddress(account.addr.toString()).publicKey

function fakeKeystore() {
  let closed = false
  const keystore = {
    export: async (id: string) =>
      id === 'key-1' ? { publicKey } : { publicKey: new Uint8Array(16) }, // key-2: wrong length
    sign: async (_id: string, data: Uint8Array) => nacl.sign.detached(data, secretKey),
    close: async () => {
      closed = true
    },
  }
  return { keystore, isClosed: () => closed }
}

const suggestedParams: algosdk.SuggestedParams = {
  flatFee: true,
  fee: BigInt(1000),
  minFee: BigInt(1000),
  firstValid: BigInt(1),
  lastValid: BigInt(1000),
  genesisID: 'testnet-v1.0',
  genesisHash: new Uint8Array(32),
}

describe('createSignerFromKeystore', () => {
  test('builds address book from exportable ed25519 keys only', async () => {
    const { keystore } = fakeKeystore()
    const signer = createSignerFromKeystore(keystore, () => [{ id: 'key-1' }, { id: 'key-2' }])
    const addresses = await signer.listAddresses()
    expect(addresses).toEqual([account.addr.toString()])
  })

  test('signs only requested group indexes with a verifying signature', async () => {
    const { keystore } = fakeKeystore()
    const signer = createSignerFromKeystore(keystore, () => [{ id: 'key-1' }])
    const txnSigner = await signer.resolveSigner(account.addr.toString())

    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: account.addr.toString(),
      receiver: account.addr.toString(),
      amount: 0,
      suggestedParams,
    })
    const [signed] = await txnSigner([txn], [0])
    const decoded = algosdk.decodeSignedTransaction(signed!)
    expect(decoded.sig).toBeDefined()
    expect(decoded.txn.txID()).toBe(txn.txID())
  })

  test('unknown address throws a helpful error after refresh', async () => {
    const { keystore } = fakeKeystore()
    const signer = createSignerFromKeystore(keystore, () => [{ id: 'key-1' }])
    await expect(
      signer.resolveSigner('OXNTQ2K3DTDMQVKV2PWQW6AYMSVZHEWJ6EPSUONVCZECIOAVPNNHIHVN3Y'),
    ).rejects.toThrow(/No key in the keystore daemon/)
  })

  test('close() forwards to the keystore (short-lived processes must not hang)', async () => {
    const { keystore, isClosed } = fakeKeystore()
    const signer = createSignerFromKeystore(keystore, () => [])
    await signer.close()
    expect(isClosed()).toBe(true)
  })
})
