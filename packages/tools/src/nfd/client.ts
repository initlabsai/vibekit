import { NfdApiClient } from '@txnlab/nfd-sdk'

export function createNfdApiClient(network: string): NfdApiClient {
  return network === 'testnet' ? NfdApiClient.testNet() : NfdApiClient.mainNet()
}
