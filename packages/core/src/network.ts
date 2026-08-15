import algosdk from 'algosdk'

/** Named networks with built-in endpoints. Custom endpoints use NetworkConfig directly. */
export type NetworkId = 'mainnet' | 'testnet' | 'localnet'

export interface EndpointConfig {
  url: string
  token?: string
  port?: number
}

export interface NetworkConfig {
  /** Network identifier; a NetworkId for named nets, free-form for custom ones. */
  id: string
  algod: EndpointConfig
  indexer: EndpointConfig
}

const LOCALNET_TOKEN = 'a'.repeat(64)

const NAMED_NETWORKS: Record<NetworkId, NetworkConfig> = {
  mainnet: {
    id: 'mainnet',
    algod: { url: 'https://mainnet-api.algonode.cloud' },
    indexer: { url: 'https://mainnet-idx.algonode.cloud' },
  },
  testnet: {
    id: 'testnet',
    algod: { url: 'https://testnet-api.algonode.cloud' },
    indexer: { url: 'https://testnet-idx.algonode.cloud' },
  },
  localnet: {
    id: 'localnet',
    algod: { url: 'http://localhost', port: 4001, token: LOCALNET_TOKEN },
    indexer: { url: 'http://localhost', port: 8980, token: LOCALNET_TOKEN },
  },
}

/** Resolve a NetworkId or pass a NetworkConfig through unchanged. */
export function resolveNetwork(network: NetworkId | NetworkConfig): NetworkConfig {
  return typeof network === 'string' ? NAMED_NETWORKS[network] : network
}

export interface NetworkClients {
  network: NetworkConfig
  algod: algosdk.Algodv2
  indexer: algosdk.Indexer
}

/** Build algod/indexer clients for a network. Hosts should build once and reuse. */
export function createNetworkClients(network: NetworkId | NetworkConfig): NetworkClients {
  const config = resolveNetwork(network)
  return {
    network: config,
    algod: new algosdk.Algodv2(config.algod.token ?? '', config.algod.url, config.algod.port),
    indexer: new algosdk.Indexer(
      config.indexer.token ?? '',
      config.indexer.url,
      config.indexer.port,
    ),
  }
}
