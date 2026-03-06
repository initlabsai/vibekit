import type algosdk from 'algosdk'
import type { NetworkStatus } from '../types.js'

/**
 * Get network status including latest round.
 * Uses the indexer /health endpoint directly since algosdk doesn't wrap it.
 */
export async function getNetworkStatus(indexer: algosdk.Indexer): Promise<NetworkStatus> {
  const result = await indexer.makeHealthCheck().do()
  return {
    latestRound: Number(result.round),
    version: result.version,
    dbAvailable: result.dbAvailable,
  }
}
