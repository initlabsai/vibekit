/**
 * algosdk TransactionSigner backed by @algorandfoundation/keystore-node's RPC
 * daemon (`keystore serve`). Keys live in the OS keychain behind the daemon;
 * this process only ever talks JSON-RPC over a local socket — no key material,
 * no native addons in the bundle (safe inside `bun build --compile` binaries).
 *
 * Two daemon quirks shape this code:
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
  /** Destroy a key and its metadata inside the keystore. Irreversible. */
  remove?(id: string): Promise<void>
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
  /**
   * Destroy the key behind an address (material and metadata). Irreversible:
   * without the key the account's funds are unrecoverable. Callers confirm
   * with the user before calling this.
   */
  removeAccount(address: string): Promise<{ keyId: string }>
  /** Drop the socket. Required in short-lived processes. */
  close(): Promise<void>
  /**
   * The daemon's sealed secrets store, when the connection provides one.
   * Consumed in-handler by credentialed tools, never exposed to agents.
   */
  secrets?: import('./dispenser.js').SecretsLike
}

interface KeyLister {
  (): Array<{ id: string; metadata?: Record<string, unknown>; publicKey?: Uint8Array }>
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
        // Prefer the state-mirrored public key; export() only as fallback —
        // for extractable keys export() also returns private material, which
        // must never linger in this process.
        let publicKey = key.publicKey
        if (!publicKey) {
          const data = await keystore.export(key.id)
          publicKey = data.publicKey
          delete (data as { privateKey?: Uint8Array }).privateKey
        }
        if (publicKey && publicKey.length === 32) {
          const name = key.metadata?.name
          next.set(algosdk.encodeAddress(publicKey), {
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
      // algosdk applies domain prefixes before calling the raw signer, and the
      // daemon signs exactly the bytes it is given.
      const { txnSigner } = algosdk.addressWithSignersFromRawEd25519Signer({
        ed25519PublicKey: algosdk.decodeAddress(address).publicKey,
        ed25519Signer: (bytes) => keystore.sign(keyId, bytes),
      })
      return txnSigner
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
    async removeAccount(address) {
      if (!keystore.remove) {
        throw new Error('This keystore connection does not support key removal')
      }
      const keyId = await keyIdFor(address)
      await keystore.remove(keyId)
      addressBook.delete(address)
      return { keyId }
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
    // the client option is `path`, not `socketPath`
    ...(options.socketPath ? { path: options.socketPath } : {}),
  })
  await keystore.ready
  const listKeys = () =>
    (store.state as { keys?: Array<{ id: string; metadata?: Record<string, unknown> }> }).keys ?? []
  const signer = createSignerFromKeystore(keystore, listKeys)
  const secrets = (keystore as unknown as { secrets?: import('./dispenser.js').SecretsLike }).secrets
  return secrets ? { ...signer, secrets } : signer
}
export { createSigningAddressesTool } from './tools.js'
export { createSigningAccountTool } from './tools.js'
export {
  createFundTestnetTool,
  DISPENSER_SECRET_ID,
  getValidAccessToken,
  hasDispenserToken,
  loadDispenserToken,
  pollForToken,
  requestDeviceCode,
  saveDispenserToken,
  type DeviceCodeResponse,
  type DispenserToken,
  type SecretsLike,
} from './dispenser.js'
