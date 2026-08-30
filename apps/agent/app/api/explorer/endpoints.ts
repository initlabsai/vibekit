/**
 * Which endpoints the explorer route serves for a network. Production reads
 * its own algod/indexer from `VIBEKIT_ALGOD_<NET>_URL` and
 * `VIBEKIT_INDEXER_<NET>_URL` (tokens optional) and refuses a network whose
 * URLs are unset; `next dev` falls back to the named endpoints core ships.
 * Localnet is always the hardcoded localhost pair.
 */
import type { LiveNetworkId } from '@initlabs/vibekit/views'

/** The endpoint shape createLiveHost accepts alongside a named network id. */
export interface NetworkConfig {
  id: string
  algod: { url: string; token?: string }
  indexer: { url: string; token?: string }
}

export class MissingEndpointsError extends Error {
  constructor(readonly missing: string[]) {
    super(`Set ${missing.join(' and ')} to serve this network`)
  }
}

export function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL === '1' || env.NODE_ENV === 'production'
}

export function networkConfigFromEnv(
  network: LiveNetworkId,
  env: NodeJS.ProcessEnv = process.env,
): LiveNetworkId | NetworkConfig {
  if (network === 'localnet') return network
  const net = network.toUpperCase()
  const algodUrl = env[`VIBEKIT_ALGOD_${net}_URL`]
  const indexerUrl = env[`VIBEKIT_INDEXER_${net}_URL`]
  if (!algodUrl || !indexerUrl) {
    if (isProduction(env)) {
      throw new MissingEndpointsError(
        [
          algodUrl ? undefined : `VIBEKIT_ALGOD_${net}_URL`,
          indexerUrl ? undefined : `VIBEKIT_INDEXER_${net}_URL`,
        ].filter((name): name is string => name !== undefined),
      )
    }
    return network
  }
  const endpoint = (url: string, token: string | undefined) => ({
    url,
    ...(token ? { token } : {}),
  })
  return {
    id: network,
    algod: endpoint(algodUrl, env[`VIBEKIT_ALGOD_${net}_TOKEN`]),
    indexer: endpoint(indexerUrl, env[`VIBEKIT_INDEXER_${net}_TOKEN`]),
  }
}
