/**
 * Vault Transit Client
 *
 * HTTP client for HashiCorp Vault's Transit secrets engine.
 * Used for Ed25519 key management and signing Algorand transactions.
 *
 * Keys never leave Vault - all signing operations happen inside Vault.
 */

import { Buffer } from 'buffer'
import type { VaultProviderConfig } from './types.js'

/**
 * Response from Vault Transit key creation/read
 */
interface VaultKeyResponse {
  data: {
    name: string
    type: string
    keys: {
      [version: string]: {
        public_key: string
        creation_time: string
      }
    }
    latest_version: number
    min_available_version: number
    min_decryption_version: number
    min_encryption_version: number
    supports_signing: boolean
  }
}

/**
 * Response from Vault Transit sign operation
 */
interface VaultSignResponse {
  data: {
    signature: string
    key_version: number
  }
}

/**
 * Response from Vault Transit key listing
 */
interface VaultListKeysResponse {
  data: {
    keys: string[]
  }
}

/**
 * Response from Vault health check
 */
interface VaultHealthResponse {
  initialized: boolean
  sealed: boolean
  standby: boolean
  performance_standby: boolean
  replication_performance_mode: string
  replication_dr_mode: string
  server_time_utc: number
  version: string
}

/**
 * Account metadata stored in KV
 */
export interface AccountMetadata {
  name: string
  address: string
  createdAt: string
}

/**
 * Response from KV v2 read
 */
interface VaultKvReadResponse {
  data: {
    data: AccountMetadata
    metadata: {
      created_time: string
      version: number
    }
  }
}

/**
 * Response from KV v2 list
 */
interface VaultKvListResponse {
  data: {
    keys: string[]
  }
}

/**
 * Vault Transit Client
 *
 * Provides methods for:
 * - Creating Ed25519 keys
 * - Reading public keys
 * - Signing arbitrary data
 * - Listing keys
 */
// Default timeout for Vault requests (10 seconds)
const VAULT_REQUEST_TIMEOUT_MS = 10000

export class VaultClient {
  private url: string
  private token: string
  private transitPath: string
  private keyPrefix: string
  private kvPath: string

  constructor(config: VaultProviderConfig) {
    this.url = config.url.replace(/\/$/, '') // Remove trailing slash
    this.token = config.token
    this.transitPath = config.transitPath || 'transit'
    this.keyPrefix = config.keyPrefix || 'algo-'
    this.kvPath = config.kvPath || 'vibekit'
  }

  /**
   * Make an authenticated request to Vault with timeout
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'LIST',
    path: string,
    body?: object
  ): Promise<T> {
    const headers: Record<string, string> = {
      'X-Vault-Token': this.token,
    }

    if (body) {
      headers['Content-Type'] = 'application/json'
    }

    // Vault LIST uses GET with ?list=true query parameter
    const actualMethod = method === 'LIST' ? 'GET' : method
    let actualPath = path
    if (method === 'LIST') {
      actualPath = path.includes('?') ? `${path}&list=true` : `${path}?list=true`
    }

    // Use AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), VAULT_REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(`${this.url}${actualPath}`, {
        method: actualMethod,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Vault API error: ${response.status} ${errorText}`)
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T
      }

      return response.json() as Promise<T>
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          'Vault request timed out. Check that Vault is running: vibekit vault status'
        )
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Get full key name with prefix
   */
  getKeyName(accountName: string): string {
    return `${this.keyPrefix}${accountName}`
  }

  /**
   * Create a new Ed25519 key for signing
   *
   * @param accountName - Account/key name (will be prefixed)
   * @returns Public key in base64
   */
  async createKey(accountName: string): Promise<string> {
    const keyName = this.getKeyName(accountName)

    await this.request('POST', `/v1/${this.transitPath}/keys/${keyName}`, {
      type: 'ed25519',
      exportable: false, // Keys never leave Vault
    })

    // Read back the key to get public key
    return this.getPublicKey(accountName)
  }

  /**
   * Get the public key for an account
   *
   * @param accountName - Account/key name
   * @returns Public key in base64
   */
  async getPublicKey(accountName: string): Promise<string> {
    const keyName = this.getKeyName(accountName)
    const response = await this.request<VaultKeyResponse>(
      'GET',
      `/v1/${this.transitPath}/keys/${keyName}`
    )

    // Get the latest version's public key
    const latestVersion = response.data.latest_version.toString()
    return response.data.keys[latestVersion].public_key
  }

  /**
   * Check if a key exists
   *
   * @param accountName - Account/key name
   */
  async keyExists(accountName: string): Promise<boolean> {
    try {
      await this.getPublicKey(accountName)
      return true
    } catch {
      return false
    }
  }

  /**
   * List all keys (account names without prefix)
   */
  async listKeys(): Promise<string[]> {
    try {
      const response = await this.request<VaultListKeysResponse>(
        'LIST',
        `/v1/${this.transitPath}/keys`
      )

      // Filter to only our prefixed keys and remove prefix
      return response.data.keys
        .filter((key) => key.startsWith(this.keyPrefix))
        .map((key) => key.slice(this.keyPrefix.length))
    } catch (error) {
      // Empty list returns 404
      if (error instanceof Error && error.message.includes('404')) {
        return []
      }
      throw error
    }
  }

  /**
   * Sign data using Transit engine
   *
   * @param accountName - Account/key name
   * @param data - Raw bytes to sign
   * @returns Signature bytes
   */
  async sign(accountName: string, data: Uint8Array): Promise<Uint8Array> {
    const keyName = this.getKeyName(accountName)

    // Vault expects base64-encoded input
    const inputB64 = Buffer.from(data).toString('base64')

    const response = await this.request<VaultSignResponse>(
      'POST',
      `/v1/${this.transitPath}/sign/${keyName}`,
      {
        input: inputB64,
        signature_algorithm: 'ed25519',
      }
    )

    // Vault returns signature as "vault:v1:base64signature"
    const signatureParts = response.data.signature.split(':')
    const signatureB64 = signatureParts[signatureParts.length - 1]

    return new Uint8Array(Buffer.from(signatureB64, 'base64'))
  }

  /**
   * Delete a key (use with caution - irreversible)
   *
   * @param accountName - Account/key name
   */
  async deleteKey(accountName: string): Promise<void> {
    const keyName = this.getKeyName(accountName)

    // First, update key to allow deletion
    await this.request('POST', `/v1/${this.transitPath}/keys/${keyName}/config`, {
      deletion_allowed: true,
    })

    // Then delete
    await this.request('DELETE', `/v1/${this.transitPath}/keys/${keyName}`)
  }

  /**
   * Check if Vault is available and unsealed
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.request<VaultHealthResponse>('GET', '/v1/sys/health')
      return response.initialized && !response.sealed
    } catch {
      return false
    }
  }

  /**
   * Get Vault seal status
   */
  async getSealStatus(): Promise<{ initialized: boolean; sealed: boolean }> {
    try {
      const response = await fetch(`${this.url}/v1/sys/seal-status`)
      if (!response.ok) {
        return { initialized: false, sealed: true }
      }
      const data = (await response.json()) as { initialized: boolean; sealed: boolean }
      return { initialized: data.initialized, sealed: data.sealed }
    } catch {
      return { initialized: false, sealed: true }
    }
  }

  /**
   * Save account metadata to KV store
   *
   * Note: KV paths use 'wallets/' for backward compatibility with existing Vault data.
   *
   * @param accountName - Account name
   * @param metadata - Metadata to store
   */
  async putAccountMetadata(accountName: string, metadata: AccountMetadata): Promise<void> {
    // Keep 'wallets/' path for backward compatibility with existing Vault data
    await this.request('POST', `/v1/${this.kvPath}/data/wallets/${accountName}`, {
      data: metadata,
    })
  }

  /**
   * Get account metadata from KV store
   *
   * @param accountName - Account name
   * @returns Metadata or null if not found
   */
  async getAccountMetadata(accountName: string): Promise<AccountMetadata | null> {
    try {
      // Keep 'wallets/' path for backward compatibility with existing Vault data
      const response = await this.request<VaultKvReadResponse>(
        'GET',
        `/v1/${this.kvPath}/data/wallets/${accountName}`
      )
      return response.data.data
    } catch (error) {
      // 404 means account doesn't exist
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  /**
   * List all account names from KV store
   *
   * @returns Array of account names
   */
  async listAccountNames(): Promise<string[]> {
    try {
      // Note: No trailing slash - Vault normalizes paths
      // LIST permission is checked against child paths (glob pattern in policy)
      // Keep 'wallets/' path for backward compatibility with existing Vault data
      const response = await this.request<VaultKvListResponse>(
        'LIST',
        `/v1/${this.kvPath}/metadata/wallets`
      )
      return response.data.keys || []
    } catch (error) {
      // 404 means no accounts exist yet
      if (error instanceof Error && error.message.includes('404')) {
        return []
      }
      throw error
    }
  }

  /**
   * Delete account metadata from KV store
   *
   * @param accountName - Account name
   */
  async deleteAccountMetadata(accountName: string): Promise<void> {
    // Keep 'wallets/' path for backward compatibility with existing Vault data
    await this.request('DELETE', `/v1/${this.kvPath}/metadata/wallets/${accountName}`)
  }

  /**
   * Check if account metadata exists in KV store
   *
   * @param accountName - Account name
   */
  async accountMetadataExists(accountName: string): Promise<boolean> {
    const metadata = await this.getAccountMetadata(accountName)
    return metadata !== null
  }
}
