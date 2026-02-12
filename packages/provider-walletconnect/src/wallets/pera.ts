/**
 * Pera Wallet Implementation
 *
 * WalletConnect v1 implementation for Pera Wallet.
 * Uses Pera's bridge infrastructure for mobile wallet connections.
 */

import WalletConnectModule from '@walletconnect/client'
import type { IConnector, IWalletConnectOptions } from '@walletconnect/types'
import type { TransactionSigner } from 'algosdk'
import type { AccountInfo, WalletId } from '@vibekit/provider-interface'
import type { WalletImplementation, WalletConfig, PairingRequest, PairingOptions } from '../types/index.js'
import { ALGORAND_CHAIN_IDS, DEFAULT_METADATA } from '../constants.js'
import { createWalletConnectSigner } from '../signing/index.js'
import { InitializationError, NoSessionError } from '../errors.js'
import { WalletConnectSessionManager, toClientMeta, buildSessionOptions } from '../session/index.js'
import { createPairingRequest, fetchBridgeUrl } from '../pairing/index.js'

// Handle both ESM and CJS module formats
const WalletConnect =
  (WalletConnectModule as { default?: new (opts: IWalletConnectOptions) => IConnector }).default ??
  (WalletConnectModule as new (opts: IWalletConnectOptions) => IConnector)

/**
 * Pera Wallet implementation using WalletConnect v1.
 */
export class PeraWallet implements WalletImplementation {
  readonly id: WalletId = 'pera'
  readonly name = 'Pera Wallet'
  readonly icon = 'https://perawallet.app/icon.png'

  private connector: IConnector | null = null
  private accounts: AccountInfo[] = []
  private config: WalletConfig | null = null
  private bridgeUrl: string | null = null
  private initialized = false
  private readonly sessionManager = new WalletConnectSessionManager('pera')

  /**
   * Map addresses to AccountInfo objects.
   */
  private mapAddressesToAccounts(addresses: string[]): AccountInfo[] {
    return addresses.map((address, index) => ({
      name: `pera-${index + 1}`,
      address,
    }))
  }

  async initialize(config: WalletConfig): Promise<void> {
    if (this.initialized) return

    this.config = config

    try {
      this.bridgeUrl = config.bridgeUrl ?? (await fetchBridgeUrl())

      const storedSession = await this.sessionManager.load()
      if (storedSession) {
        const clientMeta = toClientMeta(config.metadata ?? DEFAULT_METADATA)
        this.connector = new WalletConnect({
          bridge: storedSession.bridge,
          session: buildSessionOptions(storedSession, clientMeta),
          clientMeta,
        })

        this.accounts = this.mapAddressesToAccounts(storedSession.accounts)
        this.setupEventHandlers()

        // Validate connector state - if not connected, clear stale session
        if (!this.connector.connected) {
          await this.sessionManager.clear()
          this.accounts = []
          this.connector = null
        }
      }

      this.initialized = true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new InitializationError(message)
    }
  }

  private setupEventHandlers(): void {
    if (!this.connector) return

    this.connector.on('disconnect', async () => {
      this.connector = null
      this.accounts = []
      await this.sessionManager.clear()
    })

    this.connector.on(
      'session_update',
      async (
        error: Error | null,
        payload: { params: Array<{ accounts: string[]; chainId: number }> } | null
      ) => {
        if (error || !this.connector) return

        const addresses = payload?.params[0]?.accounts
        if (!addresses) return

        this.accounts = this.mapAddressesToAccounts(addresses)
        await this.sessionManager.save(this.connector)
      }
    )
  }

  async hasSession(): Promise<boolean> {
    return this.sessionManager.exists()
  }

  async resumeSession(): Promise<AccountInfo[]> {
    if (!this.connector?.connected) {
      return []
    }

    const addresses = this.connector.accounts
    if (!addresses || addresses.length === 0) {
      return []
    }

    this.accounts = this.mapAddressesToAccounts(addresses)
    return this.accounts
  }

  async requestPairing(options?: PairingOptions): Promise<PairingRequest> {
    if (!this.config || !this.bridgeUrl) {
      throw new InitializationError('Pera wallet not initialized')
    }

    const chainId = ALGORAND_CHAIN_IDS[this.config.network]
    const clientMeta = toClientMeta(this.config.metadata ?? DEFAULT_METADATA)

    this.connector = new WalletConnect({
      bridge: this.bridgeUrl,
      clientMeta,
    })

    this.setupEventHandlers()

    if (!this.connector.connected) {
      await this.connector.createSession({ chainId })
    }

    const pairingRequest = await createPairingRequest(
      this.connector,
      this.config,
      this.id,
      this.name,
      this.sessionManager,
      (addresses) => {
        this.accounts = this.mapAddressesToAccounts(addresses)
        return this.accounts
      },
      options
    )

    return pairingRequest
  }

  getAccounts(): AccountInfo[] {
    return this.accounts
  }

  createSigner(address: string): TransactionSigner {
    if (!this.connector?.connected) {
      throw new NoSessionError()
    }

    const account = this.accounts.find((a) => a.address === address)
    if (!account) {
      throw new Error(`Address ${address} not found in connected accounts`)
    }

    // Pass all connected addresses for verification in the signer
    const connectedAddresses = this.accounts.map((a) => a.address)
    return createWalletConnectSigner(this.connector, connectedAddresses)
  }

  async disconnect(): Promise<void> {
    if (this.connector?.connected) {
      try {
        await this.connector.killSession()
      } catch {
        // Ignore disconnect errors - session may already be invalid
      }
    }

    this.connector = null
    this.accounts = []
    await this.sessionManager.clear()
  }
}
