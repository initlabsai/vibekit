/**
 * Connect WalletConnect Tool
 *
 * Connect to a mobile wallet (Pera, Defly, etc.) via QR code.
 * By default, opens a browser window for QR scanning.
 */

import type { ToolRegistration } from '../types.js'
import { withImage } from '../types.js'
import { appState } from '../../state/index.js'
import type { WalletId } from '@vibekit/provider-interface'

interface ConnectWalletconnectArgs {
  wallet?: WalletId
  /** Set to false to use ASCII QR instead of browser (default: true) */
  browser?: boolean
}

export const connectWalletconnectTool: ToolRegistration = {
  definition: {
    name: 'connect_walletconnect',
    description:
      'Connect to a mobile wallet (Pera, Defly, etc.) via QR code. ' +
      'Opens a browser window with a QR code to scan. ' +
      'Blocks until the user scans and approves the connection. ' +
      'Only available on testnet/mainnet (not localnet). ' +
      'Set browser=false to use ASCII QR code in terminal instead. If used, render the QR code for the user.',
    inputSchema: {
      type: 'object',
      properties: {
        wallet: {
          type: 'string',
          enum: ['pera'],
          description: 'Wallet to connect to (default: pera)',
        },
        browser: {
          type: 'boolean',
          description:
            'Open browser for QR code (default: true). Set to false for ASCII QR in terminal.',
        },
      },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const { wallet = 'pera', browser = true } = args as ConnectWalletconnectArgs

    // Get or create wallet provider
    const walletProvider = await appState.getWalletProvider(wallet)

    // Check if already connected
    if (await walletProvider.hasSession()) {
      const status = await walletProvider.getStatus()
      if (status.ready && status.connection) {
        return {
          success: true,
          message: `Already connected to ${status.connection.walletName}`,
          wallet: wallet,
          network: status.connection.network,
          accounts: status.connection.accounts.map((a) => ({
            name: a.name,
            address: a.address,
          })),
          hint: 'Use disconnect_walletconnect to disconnect and pair with a different wallet.',
        }
      }
    }

    const walletName = wallet === 'pera' ? 'Pera Wallet' : wallet
    const network = appState.getWalletNetwork()

    // Browser-based flow (default)
    if (browser) {
      const pairingRequest = await walletProvider.requestPairing({
        useBrowser: true,
        timeout: 5 * 60 * 1000, // 5 minutes
      })

      // If browser URL is available, tell user a browser window was opened
      if (pairingRequest.browserUrl) {
        try {
          // Wait for user to scan and approve (blocking)
          const result = await pairingRequest.approval

          // Set first account as active
          if (result.accounts.length > 0) {
            appState.setActiveAccount(result.accounts[0].name, 'walletconnect')
          }

          return {
            success: true,
            wallet: wallet,
            network: result.network,
            accounts: result.accounts.map((a) => ({
              name: a.name,
              address: a.address,
            })),
            message: `Connected to ${result.walletName} with ${result.accounts.length} account(s)`,
          }
        } catch (error) {
          // Connection failed or timed out
          const message = error instanceof Error ? error.message : 'Connection failed'

          // Check if it's a browser open failure
          if (message.includes('Could not open browser') || message.includes('spawn')) {
            return {
              success: false,
              error: 'Could not open browser',
              hint: 'Use terminal mode: connect_walletconnect browser=false',
            }
          }

          return {
            success: false,
            error: message,
            hint: 'Try again with: connect_walletconnect',
          }
        }
      }
    }

    // Terminal-based flow (fallback)
    const pairingRequest = await walletProvider.requestPairing()

    // Build response data
    const data = {
      success: true,
      message: `Scan this QR code with ${walletName} to connect`,
      qrCode: pairingRequest.qrAscii,
      uri: pairingRequest.uri,
      instructions: [
        `1. Open ${walletName} on your mobile device`,
        '2. Tap the scan/connect button',
        '3. Scan the QR code above',
        '4. Approve the connection request',
      ],
      hint: 'The connection will be saved and can be reused in future sessions.',
    }

    // Wait for approval in background (non-blocking for terminal mode)
    pairingRequest.approval
      .then(async (pairingResult) => {
        if (pairingResult.accounts.length > 0) {
          appState.setActiveAccount(pairingResult.accounts[0].name, 'walletconnect')
        }
      })
      .catch(() => {
        // Pairing failed or timed out - handled silently
      })

    return withImage(data, pairingRequest.qrDataUrl)
  },
}
