/**
 * Application State Class
 *
 * Unified state management for network, account provider, and dispenser.
 * Encapsulates invariants and validation logic.
 */

import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { DispenserProvider } from '@vibekit/dispenser-interface'
import { KmdDispenser } from '@vibekit/dispenser-kmd'
import { TestNetDispenser, NoDispenser } from '@vibekit/dispenser-testnet'
import type { AccountProvider, AccountProviderType, WalletId } from '@vibekit/provider-interface'
import { VaultProvider } from '@vibekit/provider-vault'
import { KeyringProvider } from '@vibekit/provider-keyring'
import type { WalletProvider } from '@vibekit/provider-walletconnect'
import { getSetting, setSetting } from '@vibekit/db'
import { NETWORK_PRESETS, type NetworkType, type NetworkPreset } from '../config.js'
import type { NetworkConfig, InitConfig, VaultProviderConfig } from './types.js'

/**
 * Parse a URL and extract the base server (without port) and port separately.
 * The algosdk/algokit-utils libraries require port to be passed as a separate
 * parameter rather than included in the server URL.
 */
function parseServerUrl(url: string): { server: string; port: string | number } {
  const parsed = new URL(url)
  const server = `${parsed.protocol}//${parsed.hostname}`
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80')
  return { server, port }
}

/**
 * Create an AlgorandClient for the given network configuration.
 */
function createAlgorandClient(config: NetworkConfig): AlgorandClient {
  const algod = parseServerUrl(config.algodServer)

  if (config.network === 'localnet' && config.kmdServer && config.indexerServer) {
    const kmd = parseServerUrl(config.kmdServer)
    const indexer = parseServerUrl(config.indexerServer)
    return AlgorandClient.fromConfig({
      algodConfig: {
        server: algod.server,
        port: algod.port,
        token: config.algodToken,
      },
      kmdConfig: {
        server: kmd.server,
        port: kmd.port,
        token: config.kmdToken || '',
      },
      indexerConfig: {
        server: indexer.server,
        port: indexer.port,
      },
    })
  }

  // For testnet/mainnet, optionally include indexer but no KMD
  if (config.indexerServer) {
    const indexer = parseServerUrl(config.indexerServer)
    return AlgorandClient.fromConfig({
      algodConfig: {
        server: algod.server,
        port: algod.port,
        token: config.algodToken,
      },
      indexerConfig: {
        server: indexer.server,
        port: indexer.port,
      },
    })
  }

  return AlgorandClient.fromConfig({
    algodConfig: {
      server: algod.server,
      port: algod.port,
      token: config.algodToken,
    },
  })
}

export class AppState {
  // Network state
  private networkConfig: NetworkConfig | null = null
  private algorandClient: AlgorandClient | null = null

  private vaultProvider: VaultProvider | null = null
  private keyringProvider: KeyringProvider | null = null
  private walletProvider: WalletProvider | null = null
  private vaultConfig: VaultProviderConfig | null = null
  private dispenser: DispenserProvider | null = null
  private dispenserToken: string | null = null
  private activeAccount: string | null = null
  private activeAccountProvider: AccountProviderType | null = null

  /**
   * Initialize application state from environment variables.
   * Called once at MCP server startup.
   *
   * Network selection priority:
   * 1. ALGORAND_NETWORK env var (explicit override, also uses endpoint env vars)
   * 2. Saved network from database (user's last selection, uses presets)
   * 3. Default to 'localnet'
   *
   * When ALGORAND_NETWORK is explicitly set, endpoint env vars are also used.
   * When using saved/default network, presets are used to avoid endpoint mismatch.
   */
  initialize(config?: InitConfig): void {
    this.vaultConfig = config?.vaultConfig || null
    this.dispenserToken = config?.dispenserToken || null

    const envNetwork = process.env.ALGORAND_NETWORK as NetworkType | undefined
    const savedNetwork = getSetting('network') as NetworkType | null
    const network = envNetwork || savedNetwork || 'localnet'
    const preset = NETWORK_PRESETS[network] || NETWORK_PRESETS.localnet

    // Only use endpoint env vars when ALGORAND_NETWORK is explicitly set.
    // This prevents mismatch where saved network is testnet but endpoints point to localnet.
    const useEnvEndpoints = !!envNetwork

    this.networkConfig = {
      network,
      algodServer: useEnvEndpoints ? (process.env.ALGORAND_ALGOD || preset.algodServer) : preset.algodServer,
      algodToken: useEnvEndpoints ? (process.env.ALGORAND_TOKEN ?? preset.algodToken) : preset.algodToken,
      kmdServer: useEnvEndpoints ? (process.env.ALGORAND_KMD || preset.kmdServer) : preset.kmdServer,
      kmdToken: useEnvEndpoints ? (process.env.ALGORAND_KMD_TOKEN || preset.kmdToken) : preset.kmdToken,
      indexerServer: useEnvEndpoints ? (process.env.ALGORAND_INDEXER || preset.indexerServer) : preset.indexerServer,
    }

    this.algorandClient = createAlgorandClient(this.networkConfig)
    this.dispenser = this.createDispenser(network)
  }

  /**
   * Get the active network configuration.
   */
  getNetwork(): NetworkConfig {
    if (!this.networkConfig) {
      throw new Error('State not initialized. Call initialize() first.')
    }
    return this.networkConfig
  }

  /**
   * Get the current AlgorandClient.
   */
  getAlgorandClient(): AlgorandClient {
    if (!this.algorandClient) {
      throw new Error('State not initialized. Call initialize() first.')
    }
    return this.algorandClient
  }

  /**
   * Check if the current network is localnet.
   */
  isLocalnet(): boolean {
    return this.networkConfig?.network === 'localnet'
  }

  /**
   * Switch to a different network.
   * Clears active account if network changes (accounts are network-specific).
   * Updates dispenser to match new network.
   *
   * @returns Object with new config and optional warning if account was cleared
   */
  switchNetwork(
    network: NetworkType,
    overrides?: Partial<NetworkPreset>
  ): { config: NetworkConfig; clearedWallet: string | null } {
    const preset = NETWORK_PRESETS[network]
    if (!preset) {
      throw new Error(`Unknown network: ${network}. Valid options: localnet, testnet, mainnet`)
    }

    const previousNetwork = this.networkConfig?.network
    const clearedWallet =
      this.activeAccount && previousNetwork !== network ? this.activeAccount : null

    if (clearedWallet) {
      this.activeAccount = null
    }

    this.networkConfig = {
      network,
      algodServer: overrides?.algodServer || preset.algodServer,
      algodToken: overrides?.algodToken ?? preset.algodToken,
      kmdServer: overrides?.kmdServer || preset.kmdServer,
      kmdToken: overrides?.kmdToken || preset.kmdToken,
      indexerServer: overrides?.indexerServer || preset.indexerServer,
    }

    this.algorandClient = createAlgorandClient(this.networkConfig)
    this.dispenser = this.createDispenser(network)

    // Persist network selection for next startup
    setSetting('network', network)

    return { config: this.networkConfig, clearedWallet }
  }

  /**
   * Get an account provider by type.
   * If no type specified, returns the provider for the active account,
   * or the first available provider if no account is active.
   *
   * @param type - Optional provider type to get
   * @throws Error if no provider is available
   */
  getAccountProvider(type?: AccountProviderType): AccountProvider {
    const availableProviders = this.getAvailableProviderTypes()
    const targetType = type ?? this.activeAccountProvider ?? availableProviders[0]

    if (!targetType) {
      throw new Error(
        'No account provider available.\n' + 'Run: vibekit init\n' + 'Then restart the MCP server.'
      )
    }

    if (!this.isProviderAvailable(targetType)) {
      throw new Error(
        `Provider "${targetType}" is not available.\n` +
          `Available providers: ${availableProviders.join(', ') || 'none'}\n` +
          (targetType === 'vault' ? 'Run: vibekit vault start' : 'Run: vibekit init')
      )
    }

    if (targetType === 'vault') {
      if (!this.vaultConfig) {
        throw new Error(
          'Vault provider is not available - Vault token is missing.\n' +
            'Run: vibekit vault start\n' +
            'Then restart the MCP server.'
        )
      }
      if (!this.vaultProvider) {
        this.vaultProvider = new VaultProvider(this.vaultConfig)
      }
      return this.vaultProvider
    }

    if (targetType === 'keyring') {
      if (!this.keyringProvider) {
        this.keyringProvider = new KeyringProvider()
      }
      return this.keyringProvider
    }

    throw new Error(`Unknown provider type: ${targetType}`)
  }

  /**
   * Get an account provider with async initialization.
   * Preferred method for accessing providers - handles wallet initialization.
   *
   * @param type - Optional provider type to get
   * @returns Initialized AccountProvider
   */
  async getProvider(type?: AccountProviderType): Promise<AccountProvider> {
    const availableProviders = this.getAvailableProviderTypes()
    const targetType = type ?? this.activeAccountProvider ?? availableProviders[0]

    if (targetType === 'walletconnect') {
      return this.getWalletProvider()
    }

    // Existing sync providers - initialize() is no-op
    const provider = this.getAccountProvider(targetType)
    await provider.initialize()
    return provider
  }

  /**
   * Get the wallet provider for mobile wallet connections.
   * Lazily initializes the wallet provider on first access.
   *
   * @param walletId - Wallet to use (default: pera)
   * @returns Initialized WalletProvider
   * @throws Error if on localnet (wallets can't connect to local networks)
   */
  async getWalletProvider(walletId: WalletId = 'pera'): Promise<WalletProvider> {
    if (this.isLocalnet()) {
      throw new Error(
        'Wallet connections are not available on localnet.\n' +
          'Mobile wallets cannot connect to your local network.\n' +
          'Switch to testnet: switch_network testnet'
      )
    }

    if (!this.walletProvider || this.walletProvider.walletId !== walletId) {
      const { createWalletProvider } = await import('@vibekit/provider-walletconnect')
      this.walletProvider = createWalletProvider(walletId, {
        network: this.getWalletNetwork(),
      })
      await this.walletProvider.initialize()
    }

    return this.walletProvider
  }

  /**
   * Check if wallet connections are available.
   * Returns false on localnet since mobile wallets can't connect to local networks.
   */
  isWalletAvailable(): boolean {
    return !this.isLocalnet()
  }

  /**
   * Get the network for wallet connections.
   * Maps the current network to WalletConnect network identifiers.
   */
  getWalletNetwork(): 'mainnet' | 'testnet' {
    return this.networkConfig?.network === 'mainnet' ? 'mainnet' : 'testnet'
  }

  /**
   * Check if Vault provider is available (has MCP token).
   */
  isVaultAvailable(): boolean {
    return this.vaultConfig !== null
  }

  /**
   * Check if Keyring provider is available.
   * Keyring is always available (it's just the OS keyring).
   */
  isKeyringAvailable(): boolean {
    return true
  }

  /**
   * Check if any provider is available.
   */
  isProviderAvailable(type?: AccountProviderType): boolean {
    const available = this.getAvailableProviderTypes()
    return type ? available.includes(type) : available.length > 0
  }

  /**
   * Get all available provider types.
   * Vault is available if MCP token exists.
   * Keyring is always available.
   * Wallet is available on testnet/mainnet (not localnet).
   */
  getAvailableProviderTypes(): AccountProviderType[] {
    const providers: AccountProviderType[] = []
    if (this.vaultConfig !== null) {
      providers.push('vault')
    }
    providers.push('keyring')
    if (this.isWalletAvailable()) {
      providers.push('walletconnect')
    }
    return providers
  }

  /**
   * Get the provider type for the currently active account.
   * Returns null if no account is active.
   */
  getActiveAccountProvider(): AccountProviderType | null {
    return this.activeAccountProvider
  }

  /**
   * Get the dispenser for the current network.
   */
  getDispenser(): DispenserProvider {
    if (!this.dispenser) {
      throw new Error('State not initialized. Call initialize() first.')
    }
    return this.dispenser
  }

  /**
   * Check if a TestNet dispenser token is configured.
   */
  isDispenserTokenConfigured(): boolean {
    return this.dispenserToken !== null
  }

  /**
   * Create a dispenser for the given network.
   */
  private createDispenser(network: NetworkType): DispenserProvider {
    switch (network) {
      case 'localnet':
        if (!this.algorandClient) {
          throw new Error('AlgorandClient not initialized')
        }
        return new KmdDispenser(this.algorandClient)
      case 'testnet':
        // Pass token from file if available (falls back to env var in constructor)
        return new TestNetDispenser(this.dispenserToken ?? undefined)
      case 'mainnet':
        return new NoDispenser()
      default:
        throw new Error(`Unknown network: ${network}`)
    }
  }

  /**
   * Get the currently active account name.
   * Returns null if no account is set (uses dispenser on localnet).
   */
  getActiveAccount(): string | null {
    return this.activeAccount
  }

  /**
   * Set the active account with its provider.
   *
   * @param accountName - Account name, or null to clear (use dispenser on localnet)
   * @param providerType - Provider type the account belongs to (required if accountName is set)
   * @throws Error if trying to clear account on non-localnet (no dispenser fallback)
   */
  setActiveAccount(accountName: string | null, providerType?: AccountProviderType): void {
    if (accountName === null && !this.isLocalnet()) {
      throw new Error(
        'Clearing account is only available on localnet where dispenser can sign.\n' +
          `Current network: ${this.networkConfig?.network || 'unknown'}\n` +
          'On testnet/mainnet, select an account to use for signing.'
      )
    }

    this.activeAccount = accountName
    this.activeAccountProvider = accountName ? (providerType ?? null) : null
  }

  /**
   * Check if using the default dispenser (no active account set).
   * Only valid on localnet.
   */
  isUsingDispenser(): boolean {
    return this.activeAccount === null && this.isLocalnet()
  }

  /**
   * Reset all state (for testing).
   */
  reset(): void {
    this.networkConfig = null
    this.algorandClient = null
    this.dispenser = null
    this.dispenserToken = null
    this.activeAccount = null
    this.activeAccountProvider = null
    // Provider fields
    this.vaultProvider = null
    this.keyringProvider = null
    this.walletProvider = null
    this.vaultConfig = null
  }
}
