/**
 * Bridge URL Fetching
 *
 * Fetches WalletConnect bridge URLs from wallet configuration endpoints.
 */

import type { PeraConfig } from '../types/index.js'
import { PERA_CONFIG_URL } from '../constants.js'
import { BridgeFetchError } from '../errors.js'

/**
 * Fetch bridge URL from Pera's config endpoint.
 */
export async function fetchBridgeUrl(): Promise<string> {
  try {
    const response = await fetch(PERA_CONFIG_URL)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const config = (await response.json()) as PeraConfig
    if (!config.servers || config.servers.length === 0) {
      throw new Error('No bridge servers in config')
    }
    return config.servers[0]
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new BridgeFetchError(message)
  }
}
