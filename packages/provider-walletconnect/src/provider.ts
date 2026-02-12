/**
 * Wallet Provider
 *
 * Main facade that implements AccountProvider using modular wallet implementations.
 * Wraps specific wallet implementations (Pera, Defly, etc.) and provides a unified interface.
 */

import type {
  AccountProvider,
  AccountProviderType,
  AccountInfo,
  AccountWithSigner,
  ProviderStatus,
  WalletId,
} from '@vibekit/provider-interface'
import type { WalletConfig, PairingRequest, WalletImplementation, PairingOptions } from './types/index.js'
import {
  createWalletImplementation,
  getSupportedWallets,
  isWalletSupported,
} from './wallets/index.js'
import { CannotCreateAccountError, NoSessionError, WalletNotSupportedError } from './errors.js'

/**
 * Extended interface for wallet providers.
 * Adds wallet-specific operations beyond AccountProvider.
 */
export interface WalletProvider extends AccountProvider {
  readonly type: 'walletconnect'

  /** The specific wallet implementation */
  readonly walletId: WalletId

  /**
   * Initiate pairing with the wallet.
   * Returns immediately with QR code and approval promise.
   *
   * @param options - Optional pairing options (browser mode, timeout, etc.)
   */
  requestPairing(options?: PairingOptions): Promise<PairingRequest>

  /**
   * Disconnect from the wallet and clear session.
   */
  disconnect(): Promise<void>

  /**
   * Check if there's an active session that can be resumed.
   */
  hasSession(): Promise<boolean>
}

/**
 * WalletProvider implementation.
 * Wraps a specific wallet implementation and provides AccountProvider interface.
 */
export class WalletProviderImpl implements WalletProvider {
  readonly type = 'walletconnect' as const
  readonly walletId: WalletId

  private wallet: WalletImplementation
  private config: WalletConfig
  private initialized = false

  constructor(walletId: WalletId, config: WalletConfig) {
    if (!isWalletSupported(walletId)) {
      throw new WalletNotSupportedError(walletId, getSupportedWallets())
    }

    this.walletId = walletId
    this.config = config
    this.wallet = createWalletImplementation(walletId)
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    await this.wallet.initialize(this.config)
    this.initialized = true
  }

  async getStatus(): Promise<ProviderStatus> {
    const accounts = this.wallet.getAccounts()
    const ready = accounts.length > 0

    return {
      ready,
      message: ready
        ? `Connected to ${this.wallet.name} with ${accounts.length} account(s)`
        : `Not connected. Use connect_walletconnect to connect ${this.wallet.name}.`,
      connection: ready
        ? {
            walletId: this.walletId,
            walletName: this.wallet.name,
            accounts,
            network: this.config.network,
          }
        : undefined,
    }
  }

  async listAccounts(): Promise<AccountInfo[]> {
    return this.wallet.getAccounts()
  }

  async getAccount(name: string): Promise<AccountInfo | null> {
    const accounts = this.wallet.getAccounts()
    return accounts.find((a) => a.name === name) || null
  }

  async getAccountWithSigner(accountName: string): Promise<AccountWithSigner> {
    const account = await this.getAccount(accountName)
    if (!account) {
      throw new NoSessionError(`Account "${accountName}" not found in ${this.wallet.name}`)
    }

    return {
      address: account.address,
      signer: this.wallet.createSigner(account.address),
    }
  }

  async createAccount(_name: string): Promise<AccountInfo> {
    throw new CannotCreateAccountError(
      `Cannot create accounts in ${this.wallet.name}. ` +
        `Accounts are managed by the mobile wallet app.`
    )
  }

  canCreateAccounts(): boolean {
    return false
  }

  async isAvailable(): Promise<boolean> {
    if (!this.initialized) return false
    return this.wallet.getAccounts().length > 0
  }

  async requestPairing(options?: PairingOptions): Promise<PairingRequest> {
    if (!this.initialized) {
      await this.initialize()
    }
    return this.wallet.requestPairing(options)
  }

  async disconnect(): Promise<void> {
    await this.wallet.disconnect()
  }

  async hasSession(): Promise<boolean> {
    return this.wallet.hasSession()
  }
}

/**
 * Create a wallet provider for the specified wallet.
 */
export function createWalletProvider(walletId: WalletId, config: WalletConfig): WalletProvider {
  return new WalletProviderImpl(walletId, config)
}

export { getSupportedWallets, isWalletSupported }
