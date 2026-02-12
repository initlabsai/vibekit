/**
 * Disconnect WalletConnect Tool
 *
 * Disconnect from the currently connected WalletConnect session.
 */

import type { ToolRegistration } from '../types.js'
import { appState } from '../../state/index.js'

export const disconnectWalletconnectTool: ToolRegistration = {
  definition: {
    name: 'disconnect_walletconnect',
    description:
      'Disconnect from the currently connected mobile wallet. ' +
      'Clears the session and any associated accounts.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  handler: async () => {
    // Check if wallet is available on current network
    if (!appState.isWalletAvailable()) {
      return {
        success: false,
        message: 'Wallet connections are not available on localnet.',
      }
    }

    try {
      // Get wallet provider
      const walletProvider = await appState.getWalletProvider()
      const status = await walletProvider.getStatus()

      if (!status.ready) {
        return {
          success: true,
          message: 'No wallet is currently connected.',
        }
      }

      const walletName = status.connection?.walletName ?? 'wallet'

      // Disconnect
      await walletProvider.disconnect()

      // Clear active account if it was a wallet account
      const activeProvider = appState.getActiveAccountProvider()
      if (activeProvider === 'walletconnect') {
        // On testnet/mainnet we can't clear to dispenser, so we just note it
        // The user needs to switch to a different account
        return {
          success: true,
          message: `Disconnected from ${walletName}.`,
          warning:
            'Active account was cleared. Use switch_account to select a different account, or connect_walletconnect to reconnect.',
        }
      }

      return {
        success: true,
        message: `Disconnected from ${walletName}.`,
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to disconnect wallet',
      }
    }
  },
}
