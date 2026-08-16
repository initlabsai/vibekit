/**
 * algosdk TransactionSigner backed by @algorandfoundation/keystore-node's RPC
 * daemon (`keystore serve`). Keys live in the OS keychain behind the daemon;
 * this process only ever talks JSON-RPC over a local socket — no key material,
 * no native addons in the bundle (safe inside `bun build --compile` binaries).
 *
 * Spike learnings baked in (docs/DESIGN.md Phase 0):
 * - the daemon has no "list addresses" call, so the address book is built by
 *   export()ing each key's public key, and cached (refreshed on miss);
 * - the RPC client holds its socket open — call close() or short-lived
 *   processes hang on exit.
 */
import { createRpcKeyStore, type RpcKeyStore } from '@algorandfoundation/keystore-node/rpc'
import type { KeyStoreState } from '@algorandfoundation/keystore-core'
import { Store } from '@tanstack/store'
import algosdk from 'algosdk'

/** The subset of the keystore API the signer needs — injectable for tests. */
export interface KeystoreLike {
  export(id: string): Promise<{ publicKey?: Uint8Array }>
  sign(id: string, data: Uint8Array): Promise<Uint8Array>
  /** Create a key inside the keystore (daemon-side; no material leaves it). */
  generate?(options: {
    type: string
    algorithm: string
    extractable: boolean
    keyUsages: string[]
    params?: Record<string, unknown>
  }): Promise<string>
  close?(): Promise<void>
}

export interface KeystoreSigner {
  /** Resolve a sender address to a TransactionSigner. Plugs into ToolContext.resolveSigner. */
  resolveSigner(address: string): Promise<algosdk.TransactionSigner>
  /** All Algorand addresses (ed25519 keys) held by the daemon. */
  listAddresses(): Promise<string[]>
  /** Addresses with their keystore labels (key.metadata.name). */
  listAccounts(): Promise<Array<{ address: string; keyId: string; name?: string }>>
  /**
   * Create a new ed25519 account inside the daemon (key stays in the OS
   * keychain, unextractable; only the public address comes back). Mirrors
   * `keystore generate ed25519 --name <label>`, but because it goes through
   * the daemon's RPC the new key is immediately visible to listAddresses —
   * CLI-side generates are not, until the daemon restarts.
   */
  createAccount(name?: string): Promise<{ address: string; keyId: string }>
  /** Drop the socket. Required in short-lived processes. */
  close(): Promise<void>
}

interface KeyLister {
  (): Array<{ id: string; metadata?: Record<string, unknown> }>
}

/** Pure factory over any keystore-like backend — the testable core. */
export function createSignerFromKeystore(
  keystore: KeystoreLike,
  listKeys: KeyLister,
): KeystoreSigner {
  interface BookEntry {
    keyId: string
    name?: string
  }
  let addressBook = new Map<string, BookEntry>()

  async function refreshAddressBook(): Promise<void> {
    const next = new Map<string, BookEntry>()
    for (const key of listKeys()) {
      try {
        const data = await keystore.export(key.id)
        if (data.publicKey && data.publicKey.length === 32) {
          const name = key.metadata?.name
          next.set(algosdk.encodeAddress(data.publicKey), {
            keyId: key.id,
            ...(typeof name === 'string' ? { name } : {}),
          })
        }
      } catch {
        // non-exportable or non-ed25519 keys are simply not addressable
      }
    }
    addressBook = next
  }

  async function keyIdFor(address: string): Promise<string> {
    if (!addressBook.has(address)) await refreshAddressBook()
    const entry = addressBook.get(address)
    if (!entry) {
      throw new Error(`No key in the keystore daemon for address ${address} (is it generated? run: keystore list)`)
    }
    return entry.keyId
  }

  return {
    async resolveSigner(address) {
      const keyId = await keyIdFor(address)
      return async (txnGroup, indexesToSign) => {
        const signed: Uint8Array[] = []
        for (const index of indexesToSign) {
          const txn = txnGroup[index]!
          const signature = await keystore.sign(keyId, txn.bytesToSign())
          signed.push(txn.attachSignature(address, signature))
        }
        return signed
      }
    },
    async listAddresses() {
      await refreshAddressBook()
      return [...addressBook.keys()]
    },
    async listAccounts() {
      await refreshAddressBook()
      return [...addressBook.entries()].map(([address, entry]) => ({ address, ...entry }))
    },
    async createAccount(name?: string) {
      if (!keystore.generate) {
        throw new Error('This keystore connection does not support key generation')
      }
      const keyId = await keystore.generate({
        type: 'ed25519',
        algorithm: 'EdDSA',
        extractable: false,
        keyUsages: ['sign', 'verify'],
        ...(name ? { params: { name } } : {}),
      })
      const data = await keystore.export(keyId)
      if (!data.publicKey || data.publicKey.length !== 32) {
        throw new Error(`Key ${keyId} was created but its public key could not be read`)
      }
      const address = algosdk.encodeAddress(data.publicKey)
      addressBook.set(address, { keyId, ...(name ? { name } : {}) })
      return { address, keyId }
    },
    async close() {
      await keystore.close?.()
    },
  }
}

export interface KeystoreSignerOptions {
  /** Socket path of `keystore serve`; defaults to the daemon's default path. */
  socketPath?: string
}

/** Connect to the keystore daemon over its local socket. */
export async function createKeystoreSigner(
  options: KeystoreSignerOptions = {},
): Promise<KeystoreSigner> {
  const store = new Store({ keys: [], status: 'idle' } as unknown as KeyStoreState)
  const keystore: RpcKeyStore = createRpcKeyStore({
    store,
    ...(options.socketPath ? { socketPath: options.socketPath } : {}),
  })
  await keystore.ready
  const listKeys = () => ((store.state as { keys?: Array<{ id: string }> }).keys ?? [])
  return createSignerFromKeystore(keystore, listKeys)
}
export { createSigningAddressesTool } from './tools.js'
export { createSigningAccountTool } from './tools.js'
