export interface IndexerPreset {
  url: string
  token: string
}

/** Default indexer endpoints for each Algorand network (Nodely free tier). */
export const INDEXER_PRESETS: Record<string, IndexerPreset> = {
  mainnet: { url: 'https://mainnet-idx.4160.nodely.dev', token: '' },
  testnet: { url: 'https://testnet-idx.4160.nodely.dev', token: '' },
  localnet: {
    url: 'http://localhost:8980',
    token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  },
}
