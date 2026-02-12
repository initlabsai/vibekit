/**
 * get_provider tool
 *
 * Returns all available providers and their status.
 * Shows provider availability information.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { AccountProviderType } from '@vibekit/provider-interface'
import { appState } from '../../state/index.js'
import type { ToolContext } from '../types.js'

export const getProviderTool: Tool = {
  name: 'get_provider',
  description:
    'Get all available account providers and their status. ' +
    'Shows which providers are available for key management (Vault, Keyring, or WalletConnect).',
  inputSchema: {
    type: 'object',
    properties: {},
  },
}

export async function handleGetProvider(
  _args: Record<string, unknown>,
  _ctx: ToolContext
): Promise<{
  availableProviders: AccountProviderType[]
  providerStatus: Record<AccountProviderType, { available: boolean }>
  activeAccount: string | null
  activeAccountProvider: AccountProviderType | null
  hint: string | null
}> {
  const availableProviders = appState.getAvailableProviderTypes()
  const activeAccount = appState.getActiveAccount()
  const activeAccountProvider = appState.getActiveAccountProvider()

  // Build provider status for all possible providers
  const providerStatus: Record<AccountProviderType, { available: boolean }> = {
    vault: {
      available: appState.isProviderAvailable('vault'),
    },
    keyring: {
      available: appState.isProviderAvailable('keyring'),
    },
    walletconnect: {
      available: appState.isProviderAvailable('walletconnect'),
    },
  }

  // Determine hint based on state
  let hint: string | null = null
  if (availableProviders.length === 0) {
    hint = 'No provider available. Run: vibekit init'
  } else if (!activeAccount) {
    hint = 'Use list_accounts to see accounts, then switch_account to select one for signing.'
  }

  return {
    availableProviders,
    providerStatus,
    activeAccount,
    activeAccountProvider,
    hint,
  }
}
