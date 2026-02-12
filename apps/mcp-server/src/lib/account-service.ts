/**
 * Account Service
 *
 * Service layer for account management operations.
 * Abstracts appState interactions from MCP tools.
 *
 * Architecture:
 * - AccountProvider (Vault/Keyring/WalletConnect): Key management and signing
 * - DispenserProvider: Funding accounts (network-dependent)
 *
 * Layer hierarchy: appState → account-service → MCP tools
 */

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { AccountProviderType } from '@vibekit/provider-interface'
import type { McpConfig } from '../config.js'
import { appState } from '../state/index.js'

/**
 * Account information returned by list operations.
 */
export interface AccountInfo {
  address: string
  balance: bigint
  name?: string
}

/**
 * Account match result from provider lookups.
 */
interface AccountMatch {
  name: string
  address: string
  provider: AccountProviderType
}

/**
 * Get the default sender account based on network configuration.
 *
 * - Localnet: Uses active account or falls back to KMD dispenser for signing
 * - Testnet/Mainnet: Requires an active account
 *
 * @param algorand - AlgorandClient instance
 * @param config - MCP configuration
 * @returns Account object with addr property
 * @throws Error if no account configured on testnet/mainnet
 */
export async function getDefaultSender(
  algorand: AlgorandClient,
  config: McpConfig
): Promise<{ addr: { toString(): string } }> {
  const activeAccount = appState.getActiveAccount()

  if (activeAccount) {
    const provider = await appState.getProvider()
    const accountWithSigner = await provider.getAccountWithSigner(activeAccount)
    algorand.account.setSigner(accountWithSigner.address, accountWithSigner.signer)
    return { addr: { toString: () => accountWithSigner.address } }
  }

  if (config.network === 'localnet') {
    // Localnet: fall back to KMD dispenser account for signing
    // This provides zero-config development experience
    const dispenser = await algorand.account.kmd.getLocalNetDispenserAccount()
    algorand.account.setSignerFromAccount(dispenser)
    return dispenser
  }

  throw new Error(
    `No account selected for ${config.network}.\n` +
      'Run: vibekit init\n' +
      'Then: create_account, switch_account'
  )
}

/**
 * Get the localnet KMD dispenser account with its signer registered.
 * Used for signing transactions on localnet when no account is configured.
 *
 * Note: This is different from the DispenserProvider interface which is
 * for funding accounts. On localnet, the KMD dispenser can also sign.
 *
 * @param algorand - AlgorandClient instance
 * @returns Dispenser account object with addr property
 */
export async function getKmdDispenserAccount(
  algorand: AlgorandClient
): Promise<{ addr: { toString(): string } }> {
  const dispenser = await algorand.account.kmd.getLocalNetDispenserAccount()
  algorand.account.setSignerFromAccount(dispenser)
  return dispenser
}

/**
 * Fetch account balance, returning 0n if account doesn't exist on chain.
 *
 * @param algorand - AlgorandClient instance
 * @param address - Account address to query
 * @returns Balance in microALGO, or 0n if account not found
 */
async function getAccountBalance(algorand: AlgorandClient, address: string): Promise<bigint> {
  try {
    const info = await algorand.account.getInformation(address)
    return info.balance.microAlgo
  } catch {
    return 0n // Account may not exist on chain yet
  }
}

/**
 * Get dispenser address and balance, with KMD fallback for localnet.
 *
 * @param algorand - AlgorandClient instance
 * @returns Dispenser address and balance
 */
async function getDispenserAddressAndBalance(
  algorand: AlgorandClient
): Promise<{ address: string; balance: bigint }> {
  const dispenser = appState.getDispenser()
  const dispenserInfo = await dispenser.getInfo()

  if (dispenserInfo.address) {
    return {
      address: dispenserInfo.address,
      balance: dispenserInfo.balance ?? 0n,
    }
  }

  // Fallback to KMD dispenser account directly
  const kmdDispenser = await algorand.account.kmd.getLocalNetDispenserAccount()
  const address = kmdDispenser.addr.toString()
  const balance = await getAccountBalance(algorand, address)
  return { address, balance }
}

/**
 * Get an account with signer by address.
 * Searches provider accounts to find the address and returns an account
 * that can sign transactions.
 *
 * Checks active account first to avoid requiring list permission.
 *
 * @param algorand - AlgorandClient instance
 * @param address - The address to find
 * @returns Account with signer
 * @throws Error if address not found in any account
 */
export async function getAccountFromProvider(
  algorand: AlgorandClient,
  address: string
): Promise<{ addr: { toString(): string } }> {
  const provider = await appState.getProvider()
  const activeAccountName = appState.getActiveAccount()
  if (activeAccountName) {
    const activeAccountInfo = await provider.getAccount(activeAccountName)
    if (activeAccountInfo && activeAccountInfo.address === address) {
      const accountWithSigner = await provider.getAccountWithSigner(activeAccountName)
      algorand.account.setSigner(accountWithSigner.address, accountWithSigner.signer)
      return { addr: { toString: () => accountWithSigner.address } }
    }
  }

  try {
    const accounts = await provider.listAccounts()

    for (const account of accounts) {
      if (account.address === address) {
        const accountWithSigner = await provider.getAccountWithSigner(account.name)
        algorand.account.setSigner(accountWithSigner.address, accountWithSigner.signer)
        return { addr: { toString: () => accountWithSigner.address } }
      }
    }
  } catch (error) {
    // If list fails (permission denied), provide helpful error
    if (error instanceof Error && error.message.includes('403')) {
      throw new Error(
        `Address ${address} not found. The active account doesn't match this address, ` +
          `and listing other accounts failed (permission denied). ` +
          `Use switch_account to select the account that owns this address.`
      )
    }
    throw error
  }

  throw new Error(
    `Address ${address} not found in ${provider.type} accounts. ` +
      (activeAccountName
        ? `Active account is "${activeAccountName}". If this address belongs to a different provider, use switch_account to select the correct account first.`
        : `Use switch_account to select the account that owns this address.`)
  )
}

/**
 * List available accounts from providers and dispenser.
 *
 * @param algorand - AlgorandClient instance
 * @param config - MCP configuration
 * @returns Array of account information
 */
export async function listAccounts(
  algorand: AlgorandClient,
  config: McpConfig
): Promise<AccountInfo[]> {
  const accounts: AccountInfo[] = []

  if (appState.isProviderAvailable()) {
    try {
      const provider = await appState.getProvider()
      const providerAccounts = await provider.listAccounts()
      for (const account of providerAccounts) {
        const balance = await getAccountBalance(algorand, account.address)
        accounts.push({
          address: account.address,
          balance,
          name: `${account.name} (${provider.type})`,
        })
      }
    } catch {
      // Permission denied or other error
    }
  }

  try {
    const dispenser = appState.getDispenser()
    const dispenserInfo = await dispenser.getInfo()
    if (dispenserInfo?.available && dispenserInfo.address) {
      accounts.push({
        address: dispenserInfo.address,
        balance: dispenserInfo.balance ?? 0n,
        name: `dispenser (${dispenserInfo.type})`,
      })
    }
  } catch {
    // Dispenser might not be available
  }

  return accounts
}

/**
 * Resolve sender account for a transaction.
 * If a sender address is provided, looks it up in the active provider.
 * Otherwise, returns the default sender (active account, or dispenser on localnet).
 *
 * @param algorand - AlgorandClient instance
 * @param config - MCP configuration
 * @param sender - Optional sender address to use instead of default
 * @returns Object with sender address string
 */
export async function resolveSender(
  algorand: AlgorandClient,
  config: McpConfig,
  sender?: string
): Promise<{ address: string }> {
  const senderAccount = sender
    ? await getAccountFromProvider(algorand, sender)
    : await getDefaultSender(algorand, config)

  const address =
    typeof senderAccount.addr === 'string' ? senderAccount.addr : senderAccount.addr.toString()

  return { address }
}

/**
 * Get detailed information about a specific account.
 *
 * @param algorand - AlgorandClient instance
 * @param address - Account address to query
 * @returns Account information including balance, assets, and opted-in apps
 */
export async function getAccountInfo(
  algorand: AlgorandClient,
  address: string
): Promise<{
  address: string
  balance: bigint
  minBalance: bigint
  assets: Array<{ assetId: bigint; amount: bigint }>
  appsLocalState: Array<{ appId: bigint }>
  createdApps: Array<{ appId: bigint }>
}> {
  const info = await algorand.account.getInformation(address)

  return {
    address,
    balance: info.balance.microAlgo,
    minBalance: info.minBalance.microAlgo,
    assets: (info.assets || []).map((a) => ({
      assetId: a.assetId,
      amount: a.amount,
    })),
    appsLocalState: (info.appsLocalState || []).map((a) => ({
      appId: a.id,
    })),
    createdApps: (info.createdApps || []).map((a) => ({
      appId: a.id,
    })),
  }
}

/**
 * Get all available provider types.
 */
export function getAvailableProviders(): AccountProviderType[] {
  return appState.getAvailableProviderTypes()
}

/**
 * Validate that at least one account provider is available.
 * @param providerType - Optional specific provider to check
 */
export function requireProviderAvailable(providerType?: AccountProviderType): void {
  if (!providerType) {
    const availableProviders = appState.getAvailableProviderTypes()
    if (availableProviders.length === 0) {
      throw new Error('No account provider is available.\n' + 'Run: vibekit init')
    }
    return
  }

  if (appState.isProviderAvailable(providerType)) {
    return
  }

  if (providerType === 'vault') {
    throw new Error(
      'Vault is not available. Make sure Vault is running and unsealed:\n' + '  vibekit vault start'
    )
  }

  throw new Error(`Account provider "${providerType}" is not available.\n` + 'Run: vibekit init')
}

/**
 * Create an account in a provider.
 *
 * @param name - Account name
 * @param provider - Target provider (required if multiple available)
 * @param switchTo - Whether to switch to this account after creation (default: true)
 * @returns Created account info
 */
export async function createAccount(
  name: string,
  provider?: AccountProviderType,
  switchTo: boolean = true
): Promise<{ name: string; address: string; provider: AccountProviderType; isNew: boolean }> {
  if (!name || name.trim() === '') {
    throw new Error('Account name is required')
  }

  const availableProviders = appState.getAvailableProviderTypes()

  if (availableProviders.length === 0) {
    throw new Error(
      'No account provider available.\n' + 'Run: vibekit init\n' + 'Then restart the MCP server.'
    )
  }

  // Determine which provider to use
  let targetProvider: AccountProviderType

  // Case 1: Provider explicitly specified
  if (provider) {
    if (!appState.isProviderAvailable(provider)) {
      throw new Error(
        `Provider "${provider}" is not available.\n` +
          `Available providers: ${availableProviders.join(', ')}\n` +
          (provider === 'vault' ? 'Run: vibekit vault start' : '')
      )
    }
    targetProvider = provider
  }

  // Case 2: Only one provider available - use it
  else if (availableProviders.length === 1) {
    targetProvider = availableProviders[0]
  }

  // Case 3: Multiple providers - filter to those that can create accounts
  else {
    const creatableProviders = availableProviders.filter((p) => p !== 'walletconnect')

    if (creatableProviders.length === 0) {
      throw new Error(
        `No provider can create accounts.\n` +
          `Wallet accounts are managed in the mobile wallet app.\n` +
          `Use connect_walletconnect to connect a mobile wallet.`
      )
    }

    if (creatableProviders.length > 1) {
      throw new Error(
        `Multiple providers available: ${creatableProviders.join(', ')}.\n` +
          `Please specify which provider to create the account in using the 'provider' parameter.`
      )
    }

    targetProvider = creatableProviders[0]
  }

  const accountProvider = await appState.getProvider(targetProvider)
  if (!accountProvider.canCreateAccounts()) {
    throw new Error(
      `Cannot create accounts in ${targetProvider} provider.\n` +
        `Wallet accounts are managed in the mobile wallet app.`
    )
  }
  const accountInfo = await accountProvider.createAccount(name)

  if (switchTo) {
    appState.setActiveAccount(name, targetProvider)
  }

  return {
    name: accountInfo.name,
    address: accountInfo.address,
    provider: targetProvider,
    isNew: accountInfo.isNew ?? true,
  }
}

/**
 * Switch the active account.
 *
 * @param algorand - AlgorandClient for balance queries
 * @param name - Account name to switch to, or "default" for dispenser
 * @param provider - Optional provider to search in
 * @returns Switched account info
 */
export async function switchAccount(
  algorand: AlgorandClient,
  name: string,
  provider?: AccountProviderType
): Promise<{
  previousAccount: string | null
  name: string
  address: string
  provider: AccountProviderType | null
  balance: bigint
}> {
  if (!name || name.trim() === '') {
    throw new Error('Account name is required')
  }

  // Handle "default" as a special case - switch to dispenser (localnet only)
  if (name === 'default') {
    const previousAccount = appState.getActiveAccount()
    appState.setActiveAccount(null) // Will throw if not on localnet
    const { address, balance } = await getDispenserAddressAndBalance(algorand)

    return {
      previousAccount,
      name: 'default',
      address,
      provider: null,
      balance,
    }
  }

  const availableProviders = appState.getAvailableProviderTypes()
  const matches: AccountMatch[] = []

  for (const providerType of availableProviders) {
    if (provider && providerType !== provider) {
      continue
    }

    try {
      if (!appState.isProviderAvailable(providerType)) {
        continue
      }
      const accountProvider = await appState.getProvider(providerType)
      const accountInfo = await accountProvider.getAccount(name)
      if (accountInfo) {
        matches.push({
          name: accountInfo.name,
          address: accountInfo.address,
          provider: providerType,
        })
      }
    } catch {
      // Provider might not be available, continue searching
    }
  }

  // Handle no matches
  if (matches.length === 0) {
    const location = provider ? `${provider} provider` : 'any provider'
    const suggestion = provider
      ? 'Use list_accounts to see available accounts.'
      : 'Use list_accounts to see available accounts, or create_account to create a new one.'
    throw new Error(`Account "${name}" not found in ${location}. ${suggestion}`)
  }

  // Handle multiple matches (same name in different providers)
  if (matches.length > 1) {
    const providerList = matches.map((m) => m.provider).join(', ')
    throw new Error(
      `Account "${name}" exists in multiple providers: ${providerList}. ` +
        `Please specify the provider parameter to disambiguate.`
    )
  }

  // Single match - switch to it
  const match = matches[0]
  const previousAccount = appState.getActiveAccount()
  appState.setActiveAccount(match.name, match.provider)
  const balance = await getAccountBalance(algorand, match.address)

  return {
    previousAccount,
    name: match.name,
    address: match.address,
    provider: match.provider,
    balance,
  }
}

/**
 * Get details about the active account.
 *
 * @param algorand - AlgorandClient for balance queries
 * @returns Active account details
 */
export async function getActiveAccountDetails(algorand: AlgorandClient): Promise<{
  name: string | null
  address: string
  balance: bigint
  isDefault: boolean
}> {
  const currentAccount = appState.getActiveAccount()

  // Case 1: No account selected and not on localnet
  if (!currentAccount && !appState.isLocalnet()) {
    throw new Error(
      'No account selected. Use switch_account to select an account or create_account to create one.\n' +
        'The "default" dispenser is only available on localnet.'
    )
  }

  // Case 2: No account selected but on localnet - use dispenser
  if (!currentAccount) {
    const { address, balance } = await getDispenserAddressAndBalance(algorand)
    return {
      name: null,
      address,
      balance,
      isDefault: true,
    }
  }

  // Case 3: Account selected but provider not available
  if (!appState.isProviderAvailable()) {
    throw new Error(
      `Active account "${currentAccount}" is set but no provider is available.\n` +
        'Run: vibekit init'
    )
  }

  // Case 4: Account selected - look it up
  const provider = await appState.getProvider()
  const accountInfo = await provider.getAccount(currentAccount)

  if (!accountInfo) {
    throw new Error(
      `Active account "${currentAccount}" not found. Use switch_account to select a valid account.`
    )
  }

  const balance = await getAccountBalance(algorand, accountInfo.address)

  return {
    name: currentAccount,
    address: accountInfo.address,
    balance,
    isDefault: appState.isUsingDispenser(),
  }
}

/**
 * Fund an account from the dispenser.
 *
 * @param address - Account address to fund
 * @param amount - Amount in microALGO (optional, defaults to dispenser default)
 * @returns Transaction info
 */
export async function fundAccount(
  address: string,
  amount?: bigint
): Promise<{ txId: string; amount: bigint; dispenserType: string }> {
  if (!address) {
    throw new Error('address is required')
  }

  const dispenser = appState.getDispenser()
  const result = await dispenser.fund(address, amount)

  return {
    txId: result.txId,
    amount: result.amount,
    dispenserType: dispenser.type,
  }
}

/**
 * Account info returned by list operations for tools.
 */
export interface AccountListInfo {
  name: string
  address: string
  balance: bigint
  provider: AccountProviderType
}

/**
 * List all accounts from all providers with their balances.
 * This is for tool use - includes provider info per account.
 *
 * @param algorand - AlgorandClient for balance queries
 * @returns Array of account information with provider details
 */
export async function listAccountsForTools(
  algorand: AlgorandClient
): Promise<{ accounts: AccountListInfo[]; activeAccount: string | null }> {
  const accounts: AccountListInfo[] = []
  const availableProviders = appState.getAvailableProviderTypes()
  const activeAccount = appState.getActiveAccount()

  for (const providerType of availableProviders) {
    try {
      if (!appState.isProviderAvailable(providerType)) {
        continue
      }
      const provider = await appState.getProvider(providerType)
      const providerAccounts = await provider.listAccounts()

      for (const account of providerAccounts) {
        const balance = await getAccountBalance(algorand, account.address)
        accounts.push({
          name: account.name,
          address: account.address,
          balance,
          provider: providerType,
        })
      }
    } catch {
      // Provider might not be available, continue with other providers
    }
  }

  return { accounts, activeAccount }
}
