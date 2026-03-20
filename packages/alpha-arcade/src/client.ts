import { AlphaClient } from '@alpha-arcade/sdk'
import algosdk from 'algosdk'

const MAINNET_MATCHER_APP_ID = 3078581851
const MAINNET_USDC_ASSET_ID = 31566704

/**
 * Creates a read-only AlphaClient.
 * Uses a dummy signer since read methods don't sign transactions.
 */
export function createAlphaClient(apiKey?: string): AlphaClient {
  const algodClient = new algosdk.Algodv2('', 'https://mainnet-api.algonode.cloud', 443)
  const indexerClient = new algosdk.Indexer('', 'https://mainnet-idx.algonode.cloud', 443)

  // Dummy signer — read-only methods never call it
  const dummySigner: algosdk.TransactionSigner = async () => []
  const dummyAddress = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'

  return new AlphaClient({
    algodClient,
    indexerClient,
    signer: dummySigner,
    activeAddress: dummyAddress,
    matcherAppId: MAINNET_MATCHER_APP_ID,
    usdcAssetId: MAINNET_USDC_ASSET_ID,
    ...(apiKey && { apiKey }),
  })
}
