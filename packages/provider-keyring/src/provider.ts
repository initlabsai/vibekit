/**
 * Keyring Account Provider
 *
 * Implements AccountProvider using the OS keyring for key storage.
 * Private keys are stored encrypted by the OS keyring (macOS Keychain, Linux libsecret).
 *
 * Security model:
 * - Keys are stored encrypted by the OS
 * - Keys are loaded into memory for signing (less secure than Vault)
 * - No Docker or external services required
 *
 * Design: This provider is a pure key manager. It does NOT query network
 * state (balances, etc.). The MCP handler queries balances using a fresh
 * AlgorandClient.
 *
 * State storage (hybrid model):
 * - Secrets stored in keyring (OS-protected):
 *   - account:{name}:mnemonic → mnemonic phrase
 *   - account:{name}:privateKey → encoded private key
 * - Metadata stored in SQLite (~/.config/vibekit/accounts.db):
 *   - accounts table with name, address, created_at
 *
 * This hybrid approach avoids keyring prompts for listing/reading metadata
 * while keeping secrets secure in the OS keyring.
 */

import type {
  AccountProvider,
  AccountInfo,
  AccountWithSigner,
  AccountProviderType,
  ProviderStatus,
} from '@vibekit/provider-interface'
import {
  createKeyringStore,
  accountMnemonicKey,
  accountPrivateKeyKey,
  type SecretStore,
} from '@vibekit/keyring'
import {
  generateKey,
  keyFromMnemonic,
  createSigner,
  encodePrivateKey,
  decodePrivateKey,
  addressFromPrivateKey,
} from './keys.js'
import {
  listAccountsFromDb,
  getAccountFromDb,
  insertAccountToDb,
  deleteAccountFromDb,
  hasAccountInDb,
} from '@vibekit/db'

/**
 * Account metadata stored in SQLite.
 */
interface AccountMetadata {
  name: string
  address: string
  createdAt: string
}

/**
 * Keyring-based account provider.
 *
 * Uses a hybrid storage model:
 * - OS keyring for secrets (mnemonics, private keys)
 * - SQLite for metadata (name, address, createdAt)
 *
 * This avoids keyring prompts when listing accounts while keeping secrets secure.
 */
export class KeyringProvider implements AccountProvider {
  readonly type: AccountProviderType = 'keyring'

  private keyring: SecretStore

  constructor() {
    this.keyring = createKeyringStore()
  }

  /**
   * Initialize the provider.
   * No-op for Keyring provider - it's initialized synchronously.
   */
  async initialize(): Promise<void> {
    // No-op - Keyring provider is sync initialized
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
        ? `Keyring connected with ${accounts.length} account(s)`
        : 'Keyring is not available',
    }
  }

  /**
   * Check if this provider can create new accounts.
   */
  canCreateAccounts(): boolean {
    return true
  }

  /**
   * List all accounts.
   * Reads from SQLite index
   */
  async listAccounts(): Promise<AccountInfo[]> {
    return listAccountsFromDb().map((row) => ({
      name: row.name,
      address: row.address,
    }))
  }

  /**
   * Create a new account.
   * Does NOT fund the account - use fund_account tool for that.
   *
   * @param name - Account name
   */
  async createAccount(name: string): Promise<AccountInfo> {
    const existing = getAccountFromDb(name)
    if (existing) {
      return {
        name: existing.name,
        address: existing.address,
        isNew: false,
      }
    }

    const key = generateKey()
    const createdAt = new Date().toISOString()

    insertAccountToDb(name, key.address, createdAt)

    try {
      await this.keyring.set(accountMnemonicKey(name), key.mnemonic)
      await this.keyring.set(accountPrivateKeyKey(name), encodePrivateKey(key.privateKey))
    } catch (err) {
      // Rollback SQLite on keyring failure
      deleteAccountFromDb(name)
      throw err
    }

    return {
      name,
      address: key.address,
      isNew: true,
    }
  }

  /**
   * Get account by name.
   */
  async getAccount(name: string): Promise<AccountInfo | null> {
    const row = getAccountFromDb(name)
    if (!row) return null

    return {
      name: row.name,
      address: row.address,
    }
  }

  /**
   * Get account with signer.
   */
  async getAccountWithSigner(accountName: string): Promise<AccountWithSigner> {
    const encodedKey = await this.keyring.get(accountPrivateKeyKey(accountName))
    if (!encodedKey) {
      throw new Error(`Account not found in keyring: ${accountName}`)
    }

    const privateKey = decodePrivateKey(encodedKey)
    const address = addressFromPrivateKey(privateKey)
    const signer = createSigner(privateKey)

    return {
      address,
      signer,
    }
  }

  /**
   * Get the mnemonic for an account.
   * Used by CLI for display/backup purposes.
   */
  async getMnemonic(name: string): Promise<string | null> {
    return this.keyring.get(accountMnemonicKey(name))
  }

  /**
   * Get account metadata.
   * Returns name, address, createdAt.
   */
  async getAccountMetadata(name: string): Promise<AccountMetadata | null> {
    const row = getAccountFromDb(name)
    if (!row) return null

    return {
      name: row.name,
      address: row.address,
      createdAt: row.created_at,
    }
  }

  /**
   * Import an account from a mnemonic.
   *
   * @param name - Account name
   * @param mnemonic - 25-word Algorand mnemonic
   */
  async importAccount(name: string, mnemonic: string): Promise<AccountInfo> {
    if (hasAccountInDb(name)) {
      throw new Error(`Account already exists: ${name}`)
    }

    const key = keyFromMnemonic(mnemonic)
    const createdAt = new Date().toISOString()

    insertAccountToDb(name, key.address, createdAt)

    try {
      await this.keyring.set(accountMnemonicKey(name), key.mnemonic)
      await this.keyring.set(accountPrivateKeyKey(name), encodePrivateKey(key.privateKey))
    } catch (err) {
      // Rollback SQLite on keyring failure
      deleteAccountFromDb(name)
      throw err
    }

    return {
      name,
      address: key.address,
      isNew: true,
    }
  }

  /**
   * Remove an account.
   * Deletes keyring secrets first (critical), then SQLite metadata.
   */
  async removeAccount(name: string): Promise<void> {
    await this.keyring.delete(accountMnemonicKey(name))
    await this.keyring.delete(accountPrivateKeyKey(name))
    deleteAccountFromDb(name)
  }

  /**
   * Check if the provider is available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.keyring.has('__check__')
      return true
    } catch {
      return false
    }
  }
}
