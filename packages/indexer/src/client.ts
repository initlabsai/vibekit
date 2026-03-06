import algosdk from 'algosdk'

/** Create an Algorand Indexer client from URL and token. */
export function createIndexerClient(url: string, token: string = ''): algosdk.Indexer {
  return new algosdk.Indexer(token, url, '')
}
