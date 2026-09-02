/**
 * Raw algod/indexer clients per network, built from the same env-derived
 * endpoints the explorer host uses and cached per isolate. For server code
 * that needs the chain without the tool machinery (the entity OG routes).
 */
import { createNetworkClients, type NetworkClients } from '@initlabs/vibekit/core'
import type { LiveNetworkId } from '@initlabs/vibekit/views'

import { networkConfigFromEnv } from './endpoints'

const clients = new Map<LiveNetworkId, NetworkClients>()

export function clientsFor(network: LiveNetworkId): NetworkClients {
  let built = clients.get(network)
  if (!built) {
    built = createNetworkClients(networkConfigFromEnv(network))
    clients.set(network, built)
  }
  return built
}
