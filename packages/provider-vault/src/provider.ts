/**
 * Vault Account Provider
 *
 * Implements AccountProvider using HashiCorp Vault's Transit secrets engine.
 * Keys never leave Vault - all signing happens inside Vault.
 * Account metadata is stored in Vault's KV secrets engine.
 *
 * This provides enterprise-grade key security for Algorand development:
 * - Keys are stored encrypted in Vault (Transit engine)
 * - Account metadata stored in Vault (KV engine)
 * - Signing is done via Vault's Transit API
 * - Access is controlled by Vault policies and tokens
 * - Audit logging of all sign operations
 *
 * Design: This provider is a pure key manager. It does NOT query network
 * state (balances, etc.). The MCP handler queries balances using a fresh
 * AlgorandClient.
 */

import { encodeAddress } from 'algosdk'
import type { TransactionSigner, Transaction } from 'algosdk'
import type {
  AccountProvider,
  AccountInfo,
  AccountWithSigner,
  ProviderStatus,
} from '@vibekit/provider-interface'
import type { VaultProviderConfig } from './types.js'
import { VaultClient } from './client.js'

/**
 * Vault-based account provider.
 *
 * Uses Vault Transit secrets engine for Ed25519 key management and signing.
 * Uses Vault KV secrets engine for account metadata storage.
 * Keys never leave Vault - the MCP only receives signatures.
 */
export class VaultProvider implements AccountProvider {
  readonly type = 'vault' as const

  private client: VaultClient
  private config: VaultProviderConfig

  constructor(config: VaultProviderConfig) {
    this.config = config
    this.client = new VaultClient(config)
  }

  /**
   * Initialize the provider.
   * No-op for Vault provider - it's initialized synchronously.
   */
  async initialize(): Promise<void> {
    // No-op - Vault provider is sync initialized
  }

  /**
   * Get detailed status information about the provider.
   */
  async getStatus(): Promise<ProviderStatus> {
    const ready = await this.isAvailable()
    const accounts = ready ? await this.listAccounts() : []
    return {
      ready,
      message: ready
        ? `Vault connected with ${accounts.length} account(s)`
        : 'Vault is not available. Run: vibekit vault start',
    }
  }

  /**
   * Check if this provider can create new accounts.
   */
  canCreateAccounts(): boolean {
    return true
  }

  /**
   * Convert Ed25519 public key to Algorand address
   *
   * Algorand addresses are base32-encoded public keys with a 4-byte checksum.
   */
  private publicKeyToAddress(publicKeyB64: string): string {
    const publicKey = new Uint8Array(Buffer.from(publicKeyB64, 'base64'))
    return encodeAddress(publicKey)
  }

  /**
   * List all accounts from Vault KV store
   *
   * Reads account names from KV, then fetches addresses from Transit keys.
   * Does NOT query balances - that's the MCP handler's job.
   */
  async listAccounts(): Promise<AccountInfo[]> {
    const accountNames = await this.client.listAccountNames()
    const accounts: AccountInfo[] = []

    for (const name of accountNames) {
      try {
        // Get address from Transit key
        const publicKeyB64 = await this.client.getPublicKey(name)
        const address = this.publicKeyToAddress(publicKeyB64)

        accounts.push({ name, address })
      } catch {
        // Skip accounts whose keys can't be read
      }
    }

    return accounts
  }

  /**
   * Create a new account in Vault
   *
   * Creates a Transit key for signing and stores metadata in KV.
   * Does NOT fund the account - use fund_account tool for that.
   *
   * @param name - Account name
   */
  async createAccount(name: string): Promise<AccountInfo> {
    const existingMetadata = await this.client.getAccountMetadata(name)
    const keyExists = await this.client.keyExists(name)

    let publicKeyB64: string
    let isNew = false

    if (keyExists) {
      publicKeyB64 = await this.client.getPublicKey(name)
    } else {
      publicKeyB64 = await this.client.createKey(name)
      isNew = true
    }

    const address = this.publicKeyToAddress(publicKeyB64)

    if (!existingMetadata) {
      await this.client.putAccountMetadata(name, {
        name,
        address,
        createdAt: new Date().toISOString(),
      })
    }

    return { name, address, isNew }
  }

  /**
   * Get account by name
   */
  async getAccount(name: string): Promise<AccountInfo | null> {
    try {
      const metadata = await this.client.getAccountMetadata(name)
      if (!metadata) {
        return null
      }

      const publicKeyB64 = await this.client.getPublicKey(name)
      const address = this.publicKeyToAddress(publicKeyB64)

      return { name, address }
    } catch {
      return null
    }
  }

  /**
   * Get account with signer for an account
   *
   * Returns an account with a transaction signer that uses Vault Transit
   * for signing. The private key never leaves Vault.
   */
  async getAccountWithSigner(accountName: string): Promise<AccountWithSigner> {
    const publicKeyB64 = await this.client.getPublicKey(accountName)
    const address = this.publicKeyToAddress(publicKeyB64)
    const signer = this.createVaultSigner(accountName)

    return {
      address,
      signer,
    }
  }

  /**
   * Create a TransactionSigner that uses Vault Transit for signing
   *
   * This is the key integration point - the signer calls Vault's Transit
   * API to sign transaction bytes. The private key never leaves Vault.
   */
  private createVaultSigner(accountName: string): TransactionSigner {
    const client = this.client

    return async (txnGroup: Transaction[], indexesToSign: number[]): Promise<Uint8Array[]> => {
      const signedTxns: Uint8Array[] = []

      for (const idx of indexesToSign) {
        const txn = txnGroup[idx]

        // Algorand signs with "TX" prefix
        const txnBytes = txn.bytesToSign()

        // Private key never leaves Vault
        const signature = await client.sign(accountName, txnBytes)

        const signedTxn = txn.attachSignature(txn.sender, signature)

        signedTxns.push(signedTxn)
      }

      return signedTxns
    }
  }

  /**
   * Check if Vault is available and unsealed
   */
  async isAvailable(): Promise<boolean> {
    return this.client.isAvailable()
  }

  /**
   * Get the underlying Vault client for advanced operations
   */
  getVaultClient(): VaultClient {
    return this.client
  }
}
