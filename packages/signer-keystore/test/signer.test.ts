import { describe, expect, test } from 'bun:test'
import algosdk from 'algosdk'
import nacl from 'tweetnacl'
import { createSignerFromKeystore, createSigningAddressesTool, createSigningAccountTool } from '../src/index.js'

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

describe('createSigningAddressesTool', () => {
  test('lists the daemon address book as table rows', async () => {
    const { keystore } = fakeKeystore()
    const signer = createSignerFromKeystore(keystore, () => [
      { id: 'key-1', metadata: { name: 'dev-account' } },
      { id: 'key-2' },
    ])
    const tool = createSigningAddressesTool(signer)

    expect(tool.name).toBe('list_signing_addresses')
    expect(tool.requiresSigner).toBeUndefined() // a read tool — never gated

    const result = await tool.handler({} as never, {} as never)
    expect(result).toEqual({
      accounts: [{ address: account.addr.toString(), name: 'dev-account' }],
      count: 1, // key-2 has a non-ed25519 public key and is not addressable
    })
  })

  test('includeBalances enriches from the context algod', async () => {
    const { keystore } = fakeKeystore()
    const signer = createSignerFromKeystore(keystore, () => [{ id: 'key-1' }])
    const tool = createSigningAddressesTool(signer)

    const ctx = {
      algod: {
        accountInformation: () => ({ do: async () => ({ amount: 5_000_000n }) }),
      },
    }
    const result = (await tool.handler(ctx as never, { includeBalances: true } as never)) as {
      accounts: Array<{ balanceAlgo?: number }>
    }
    expect(result.accounts[0]!.balanceAlgo).toBe(5)
  })
})

describe('createAccount / create_signing_account', () => {
  function generatingKeystore() {
    const created: Array<{ id: string; publicKey: Uint8Array; params?: Record<string, unknown> }> = []
    const fresh = algosdk.generateAccount()
    const keystore = {
      export: async (id: string) => {
        const hit = created.find((k) => k.id === id)
        return hit ? { publicKey: hit.publicKey } : { publicKey }
      },
      sign: async (_id: string, data: Uint8Array) => nacl.sign.detached(data, secretKey),
      generate: async (options: { params?: Record<string, unknown> }) => {
        const id = `gen-${created.length + 1}`
        created.push({
          id,
          publicKey: algosdk.decodeAddress(fresh.addr.toString()).publicKey,
          params: options.params,
        })
        return id
      },
    }
    return { keystore, created, freshAddr: fresh.addr.toString() }
  }

  test('creates via daemon RPC, returns encoded address, address book updates', async () => {
    const { keystore, created, freshAddr } = generatingKeystore()
    const signer = createSignerFromKeystore(keystore, () =>
      [{ id: 'key-1' }, ...created.map((k) => ({ id: k.id }))],
    )

    const result = await signer.createAccount('my-label')
    expect(result.keyId).toBe('gen-1')
    expect(result.address).toBe(freshAddr)
    expect(algosdk.isValidAddress(result.address)).toBe(true)
    expect(created[0]!.params).toEqual({ name: 'my-label' })

    // immediately listable — the daemon's store is the source
    expect(await signer.listAddresses()).toContain(freshAddr)
  })

  test('tool wraps it with a schema and never returns key material', async () => {
    const { keystore, freshAddr } = generatingKeystore()
    const signer = createSignerFromKeystore(keystore, () => [])
    const tool = createSigningAccountTool(signer)

    const result = (await tool.handler({} as never, { name: 'x' } as never)) as Record<string, unknown>
    expect(result.address).toBe(freshAddr)
    expect(Object.keys(result).sort()).toEqual(['address', 'keyId', 'name'])
  })

  test('clear error when the connection cannot generate', async () => {
    const { keystore } = fakeKeystore()
    const signer = createSignerFromKeystore(keystore, () => [])
    expect(signer.createAccount()).rejects.toThrow('does not support key generation')
  })
})
