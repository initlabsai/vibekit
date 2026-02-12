/**
 * Account Provider Interface
 *
 * Shared contract for account providers in the Vibekit ecosystem.
 * Providers implement this interface to enable consistent account management.
 *
 * Design principle: Providers are pure key managers. They store/retrieve keys
 * and sign transactions. They do NOT query network state (balances, etc.).
 * Network queries are the responsibility of the MCP handler using a fresh
 * AlgorandClient.
 */

import type { TransactionSigner } from 'algosdk'

/**
 * Supported account provider types.
 * - 'vault': HashiCorp Vault Transit engine (keys never leave Vault)
 * - 'keyring': OS keyring (macOS Keychain, Linux libsecret)
 * - 'walletconnect': Mobile wallet via WalletConnect (Pera, Defly, etc.)
 */
export type AccountProviderType = 'vault' | 'keyring' | 'walletconnect'

/**
 * Supported wallet identifiers for mobile wallet providers.
 */
export type WalletId = 'pera' | 'defly'

/**
 * Provider status information.
 * Used by getStatus() to provide detailed provider state.
 */
export interface ProviderStatus {
  /** Whether the provider is ready to use */
  ready: boolean
  /** Human-readable status message */
  message: string
  /** Connection details (wallet-specific) */
  connection?: {
    walletId: WalletId
    walletName: string
    accounts: AccountInfo[]
    network: string
  }
}

/**
 * Information about a named account.
 * Note: Balance is NOT included - that's network state, not key state.
 * The MCP handler queries balances using a fresh AlgorandClient.
 */
export interface AccountInfo {
  /** Account name/identifier */
  name: string
  /** Algorand address */
  address: string
  /** Whether this is a newly created account */
  isNew?: boolean
}

/**
 * Account with transaction signer.
 * Used for signing transactions with the account's key.
 */
export interface AccountWithSigner {
  /** Account address */
  address: string
  /** Transaction signer function */
  signer: TransactionSigner
}

/**
 * Account provider interface.
 *
 * All account providers must implement this interface to be compatible
 * with the Vibekit MCP server and CLI tools.
 *
 * Providers are pure key managers - they do NOT query network state.
 */
export interface AccountProvider {
  /** Provider type identifier */
  readonly type: AccountProviderType

  /**
   * Initialize the provider.
   * For sync providers (Vault, Keyring) this is a no-op.
   * For async providers (Wallet) this sets up connections.
   */
  initialize(): Promise<void>

  /**
   * Get detailed status information about the provider.
   */
  getStatus(): Promise<ProviderStatus>

  /**
   * Check if this provider can create new accounts.
   * Returns false for wallet providers (accounts are managed by mobile app).
   */
  canCreateAccounts(): boolean

  /**
   * List all accounts managed by this provider.
   */
  listAccounts(): Promise<AccountInfo[]>

  /**
   * Create a new account.
   *
   * @param name - Account name
   */
  createAccount(name: string): Promise<AccountInfo>

  /**
   * Get account by name.
   *
   * @param name - Account name
   * @returns Account info or null if not found
   */
  getAccount(name: string): Promise<AccountInfo | null>

  /**
   * Get an account with signer.
   *
   * @param accountName - Account name
   * @returns Account with transaction signer
   */
  getAccountWithSigner(accountName: string): Promise<AccountWithSigner>

  /**
   * Check if the provider is available and ready.
   */
  isAvailable(): Promise<boolean>
}
