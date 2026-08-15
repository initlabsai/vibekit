/**
 * algosdk.TransactionSigner backed by the keystore-node RPC daemon
 * (V2-DESIGN §6). This process never touches key material — it forwards
 * sign requests over the local socket to `keystore serve`.
 */
import { createRpcKeyStore, type RpcKeyStore } from '@algorandfoundation/keystore-node/rpc'
import { Store } from '@tanstack/store'
import type { KeyStoreState } from '@algorandfoundation/keystore-core'
import algosdk from 'algosdk'

let keystore: RpcKeyStore | null = null
let store: Store<KeyStoreState> | null = null

async function getKeystore(): Promise<RpcKeyStore> {
  if (keystore) return keystore
  store = new Store<KeyStoreState>({ keys: [], status: 'idle' } as unknown as KeyStoreState)
  keystore = createRpcKeyStore({ store })
  await keystore.ready
  return keystore
}

/** address → keyId, built from exported public keys of every key in the daemon. */
async function addressMap(ks: RpcKeyStore): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const keys = (store?.state as { keys?: Array<{ id: string }> })?.keys ?? []
  for (const key of keys) {
    const data = await ks.export(key.id)
    if (data.publicKey && data.publicKey.length === 32) {
      map.set(algosdk.encodeAddress(data.publicKey), key.id)
    }
  }
  return map
}

/** List all Algorand addresses held by the keystore daemon. */
export async function listKeystoreAddresses(): Promise<string[]> {
  const ks = await getKeystore()
  return [...(await addressMap(ks)).keys()]
}

/** Resolve a sender address to a TransactionSigner (V2-DESIGN §4 shape). */
export async function resolveKeystoreSigner(address: string): Promise<algosdk.TransactionSigner> {
  const ks = await getKeystore()
  const keyId = (await addressMap(ks)).get(address)
  if (!keyId) {
    throw new Error(`No key in the keystore daemon for address ${address}`)
  }
  return async (txnGroup, indexesToSign) => {
    const signed: Uint8Array[] = []
    for (const i of indexesToSign) {
      const txn = txnGroup[i]!
      const signature = await ks.sign(keyId, txn.bytesToSign())
      signed.push(txn.attachSignature(address, signature))
    }
    return signed
  }
}
