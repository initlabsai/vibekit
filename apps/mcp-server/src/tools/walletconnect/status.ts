/**
 * WalletConnect Status Tool
 *
 * Check the status of WalletConnect connections.
 */

import type { ToolRegistration } from '../types.js'
import { appState } from '../../state/index.js'

export const walletconnectStatusTool: ToolRegistration = {
  definition: {
    name: 'walletconnect_status',
    description:
      'Check the status of mobile wallet connections. ' +
      'Shows whether a wallet is connected and which accounts are available.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  handler: async () => {
    // Check if wallet is available on current network
    if (!appState.isWalletAvailable()) {
      return {
        available: false,
        message:
          'Wallet connections are not available on localnet.\n' +
          'Mobile wallets cannot connect to your local network.\n' +
          'Switch to testnet: switch_network testnet',
        network: appState.getNetwork().network,
      }
    }

    try {
      // Get wallet provider and status
      const walletProvider = await appState.getWalletProvider()
      const status = await walletProvider.getStatus()

      if (status.ready && status.connection) {
        return {
          connected: true,
          wallet: status.connection.walletName,
          walletId: status.connection.walletId,
          network: status.connection.network,
          accounts: status.connection.accounts.map((a) => ({
            name: a.name,
            address: a.address,
          })),
          activeAccount: appState.getActiveAccount(),
          hint: 'Use switch_account to change the active account, or disconnect_walletconnect to disconnect.',
        }
      } else {
        return {
          connected: false,
          message: status.message,
          network: appState.getWalletNetwork(),
          hint: 'Use connect_walletconnect to connect a mobile wallet.',
        }
      }
    } catch (error) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Failed to get wallet status',
        network: appState.getWalletNetwork(),
        hint: 'Use connect_walletconnect to connect a mobile wallet.',
      }
    }
  },
}
