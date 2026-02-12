/**
 * WalletConnect Pairing Flow
 *
 * Handles QR code generation and pairing approval for WalletConnect v1.
 * Encapsulates the async pairing flow logic with support for both
 * terminal (ASCII QR) and browser-based flows.
 */

import type { IConnector } from '@walletconnect/types'
import type { WalletId, AccountInfo } from '@vibekit/provider-interface'
import type { PairingRequest, PairingResult, WalletConfig } from '../types/index.js'
import { generateQR } from './qr.js'
import { InitializationError, NoSessionError } from '../errors.js'
import { CHAIN_ID_TO_NETWORK } from '../constants.js'
import { WalletConnectSessionManager } from '../session/index.js'
import { startPairingServer, type PairingServer } from './server.js'

/** Callback to map addresses to accounts */
export type AddressMapper = (addresses: string[]) => AccountInfo[]

/** Options for pairing request */
export interface PairingOptions {
  /** Use browser-based flow with local server (default: false for backwards compat) */
  useBrowser?: boolean
  /** Whether to open browser automatically (default: true, only used when useBrowser is true) */
  openBrowser?: boolean
  /** Connection timeout in ms (default: 5 minutes, only used when useBrowser is true) */
  timeout?: number
}

/**
 * Create a pairing request with QR codes and approval promise.
 *
 * @param connector - WalletConnect connector with created session
 * @param config - Wallet configuration
 * @param walletId - ID of the wallet being paired
 * @param walletName - Display name of the wallet
 * @param sessionManager - Session manager for persistence
 * @param mapAddresses - Function to convert addresses to AccountInfo[]
 * @param options - Optional pairing options (browser mode, timeout, etc.)
 * @returns Pairing request with URI, QR codes, and approval promise
 */
export async function createPairingRequest(
  connector: IConnector,
  config: WalletConfig,
  walletId: WalletId,
  walletName: string,
  sessionManager: WalletConnectSessionManager,
  mapAddresses: AddressMapper,
  options?: PairingOptions
): Promise<PairingRequest> {
  const uri = connector.uri
  if (!uri) {
    throw new InitializationError('Failed to generate WalletConnect URI')
  }

  const qr = await generateQR(uri)
  const networkName = config.network === 'mainnet' ? 'MainNet' : 'TestNet'

  // Create base approval promise that handles WalletConnect events
  const createApprovalPromise = (server?: PairingServer) => {
    return new Promise<PairingResult>((resolve, reject) => {
      connector.on('connect', async (error: Error | null) => {
        if (error) {
          server?.signalError(error)
          reject(error)
          return
        }

        await sessionManager.save(connector)

        const addresses = connector.accounts
        const accounts = mapAddresses(addresses)
        const connectedChainId = connector.chainId
        const network = CHAIN_ID_TO_NETWORK[connectedChainId] || 'testnet'

        const result: PairingResult = {
          walletId,
          walletName,
          accounts,
          network,
        }

        // Signal success to browser if using browser mode
        server?.signalConnected(result)
        resolve(result)
      })

      connector.on('disconnect', () => {
        const error = new NoSessionError('Connection was rejected or closed')
        server?.signalError(error)
        reject(error)
      })
    })
  }

  // Browser-based flow
  if (options?.useBrowser) {
    const server = await startPairingServer({
      uri,
      qrDataUrl: qr.dataUrl,
      network: config.network,
      walletName,
      timeout: options.timeout,
      openBrowser: options.openBrowser ?? true,
    })

    const approval = createApprovalPromise(server)

    // When approval resolves/rejects, ensure server cleanup
    approval.finally(() => {
      server.close().catch(() => {})
    })

    return {
      uri,
      qrAscii: qr.ascii,
      qrDataUrl: qr.dataUrl,
      instructions: `Open ${walletName} on ${networkName} and scan this QR code to connect.`,
      approval,
      browserUrl: server.url,
    }
  }

  // Terminal-based flow (original behavior)
  const approval = createApprovalPromise()

  return {
    uri,
    qrAscii: qr.ascii,
    qrDataUrl: qr.dataUrl,
    instructions: `Open ${walletName} on ${networkName} and scan this QR code to connect.`,
    approval,
  }
}
