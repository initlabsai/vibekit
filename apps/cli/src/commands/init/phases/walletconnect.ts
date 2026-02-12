/**
 * WalletConnect Bootstrap Phase
 *
 * Initializes the database for WalletConnect session storage.
 * WalletConnect itself requires no complex setup - just the database
 * for storing wallet sessions.
 */

import * as p from '@clack/prompts'
import { initAccountsDb } from '@vibekit/provider-keyring'
import type { WalletConnectSetupStatus } from '../../../types'

export interface WalletConnectBootstrapResult {
  status: WalletConnectSetupStatus
  error?: string
}

export async function walletConnectBootstrapStep(): Promise<WalletConnectBootstrapResult> {
  const s = p.spinner()

  s.start('Initializing WalletConnect support...')

  try {
    // Initialize accounts database (idempotent - safe to call multiple times)
    initAccountsDb()

    s.stop('WalletConnect ready')
    return { status: 'completed' }
  } catch (error) {
    s.stop('WalletConnect initialization error')
    const msg = error instanceof Error ? error.message : 'Unknown error'
    p.log.error(msg)
    return { status: 'error', error: msg }
  }
}
