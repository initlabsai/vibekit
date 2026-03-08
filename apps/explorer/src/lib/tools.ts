import { z } from 'zod'
import { tool, type ToolSet } from 'ai'
import { createIndexerClient, INDEXER_PRESETS, indexerTools, sanitizeBigInts, formatAssetAmount, type FormattedTransaction } from '@vibekit/indexer'
import { createNfdApiClient, nfdTools } from '@vibekit/nfd'
import { env } from '@/lib/env'

type IndexerClient = ReturnType<typeof createIndexerClient>

// ---------------------------------------------------------------------------
// LRU cache (Map insertion-order semantics, no deps)
// ---------------------------------------------------------------------------
class LRUCache<K, V> {
  private map = new Map<K, V>()
  constructor(private capacity: number) {}

  get(key: K): V | undefined {
    const val = this.map.get(key)
    if (val !== undefined) {
      // refresh position
      this.map.delete(key)
      this.map.set(key, val)
    }
    return val
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this.capacity) {
      // evict oldest
      this.map.delete(this.map.keys().next().value!)
    }
  }

  has(key: K): boolean {
    return this.map.has(key)
  }
}

// ---------------------------------------------------------------------------
// Asset enrichment
// ---------------------------------------------------------------------------
interface AssetInfo {
  name?: string
  unitName?: string
  decimals: number
}

const assetCache = new LRUCache<number, AssetInfo>(500)

const TRANSACTION_TOOLS = new Set([
  'lookup_transaction',
  'search_transactions',
  'lookup_transaction_group',
  'search_asset_transactions',
  'search_account_transactions',
])

function collectAssetIds(txns: FormattedTransaction[], ids = new Set<number>()): Set<number> {
  for (const tx of txns) {
    if (tx.assetId != null) ids.add(tx.assetId)
    if (tx.innerTxns) collectAssetIds(tx.innerTxns, ids)
  }
  return ids
}

function extractTransactions(raw: unknown): FormattedTransaction[] {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object' && 'transactions' in raw)
    return (raw as { transactions: FormattedTransaction[] }).transactions
  if (raw && typeof raw === 'object' && 'id' in raw)
    return [raw as FormattedTransaction]
  return []
}

function attachAssetInfo(txns: FormattedTransaction[]): void {
  for (const tx of txns) {
    if (tx.assetId != null) {
      const info = assetCache.get(tx.assetId)
      if (info) {
        tx.assetName = info.name
        tx.assetUnitName = info.unitName
        tx.assetDecimals = info.decimals
        if (info && tx.assetAmount != null) {
          tx.assetAmount = formatAssetAmount(String(tx.assetAmount), info.decimals)
        }
      }
    }
    if (tx.innerTxns) attachAssetInfo(tx.innerTxns)
  }
}

async function enrichTransactions(indexer: IndexerClient, txns: FormattedTransaction[]): Promise<void> {
  const ids = collectAssetIds(txns)
  const uncached = [...ids].filter((id) => !assetCache.has(id))

  if (uncached.length > 0) {
    const results = await Promise.allSettled(
      uncached.map(async (id) => {
        const res = await indexer.lookupAssetByID(id).do()
        const params = res.asset.params
        return {
          id,
          name: params.name as string | undefined,
          unitName: params.unitName as string | undefined,
          decimals: Number(params.decimals ?? 0),
        }
      }),
    )
    for (const r of results) {
      if (r.status === 'fulfilled') {
        assetCache.set(r.value.id, { name: r.value.name, unitName: r.value.unitName, decimals: r.value.decimals })
      }
    }
  }

  attachAssetInfo(txns)
}

/** Fetch the latest round from the Algod `/v2/status` endpoint. */
async function getLatestRoundFromAlgod(algodUrl: string): Promise<number> {
  const res = await fetch(`${algodUrl}/v2/status`, {
    headers: { 'X-Algo-API-Token': '' },
  })
  if (!res.ok) throw new Error(`Algod status request failed: ${res.status}`)
  const data = await res.json()
  return Number(data['last-round'])
}

/** Tools overridden in the explorer to avoid the Indexer health check. */
const OVERRIDDEN_TOOLS = new Set(['get_network_status', 'lookup_block'])

/** Wrap @vibekit/indexer and @vibekit/nfd tools as AI SDK tool definitions. */
export function createExplorerTools(): ToolSet {
  const network = env.ALGORAND_NETWORK
  const preset = INDEXER_PRESETS[network] ?? INDEXER_PRESETS.mainnet
  const url = process.env.ALGORAND_INDEXER_URL ?? preset.url
  const token = process.env.ALGORAND_INDEXER_TOKEN ?? preset.token
  const algodUrl = env.ALGORAND_ALGOD_URL

  const indexer = createIndexerClient(url, token)
  const nfdApi = createNfdApiClient(network)

  const tools: ToolSet = {}

  for (const t of indexerTools) {
    if (OVERRIDDEN_TOOLS.has(t.name)) continue

    tools[t.name] = tool({
      description: t.description,
      inputSchema: t.parameters,
      execute: async (args: Record<string, unknown>) => {
        const start = Date.now()
        try {
          const raw = await t.handler(indexer, args)

          // Enrich transaction results with asset metadata
          if (TRANSACTION_TOOLS.has(t.name)) {
            const txns = extractTransactions(raw)
            if (txns.length > 0) await enrichTransactions(indexer, txns)
          }

          const result = sanitizeBigInts(raw)
          console.log(`[tool:${t.name}] ${Date.now() - start}ms`)
          return result
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error(`[tool:${t.name}] ${Date.now() - start}ms error:`, message)
          return { error: message }
        }
      },
    })
  }

  // get_network_status — use Algod instead of Indexer health check
  tools.get_network_status = tool({
    description: 'Get the current network status including the latest round number. Use this to find the most recent block.',
    inputSchema: z.object({}),
    execute: async () => {
      const start = Date.now()
      try {
        const latestRound = await getLatestRoundFromAlgod(algodUrl)
        console.log(`[tool:get_network_status] ${Date.now() - start}ms`)
        return { latestRound }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[tool:get_network_status] ${Date.now() - start}ms error:`, message)
        return { error: message }
      }
    },
  })

  // lookup_block — use Algod for latest round, then full block lookup for transaction count
  tools.lookup_block = tool({
    description: 'Look up a block by its round number. If no round is provided, returns the latest block.',
    inputSchema: z.object({
      round: z.number().nullish().describe('The round number of the block (omit for latest)'),
    }),
    execute: async (args) => {
      const start = Date.now()
      try {
        const round = args.round ?? (await getLatestRoundFromAlgod(algodUrl))
        const block = await indexer.lookupBlock(round).do()
        const result = sanitizeBigInts({
          round: Number(block.round),
          timestamp: Number(block.timestamp),
          transactionCount: block.transactions?.length ?? 0,
          proposer: block.proposer ? String(block.proposer) : undefined,
          feesCollected: block.feesCollected != null ? Number(block.feesCollected) / 1_000_000 : undefined,
          proposerPayout: block.proposerPayout != null ? Number(block.proposerPayout) / 1_000_000 : undefined,
        })
        console.log(`[tool:lookup_block] ${Date.now() - start}ms`)
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[tool:lookup_block] ${Date.now() - start}ms error:`, message)
        return { error: message }
      }
    },
  })

  for (const t of nfdTools) {
    tools[t.name] = tool({
      description: t.description,
      inputSchema: t.parameters,
      execute: async (args: Record<string, unknown>) => {
        const start = Date.now()
        try {
          const result = sanitizeBigInts(await t.handler(nfdApi, args))
          console.log(`[tool:${t.name}] ${Date.now() - start}ms`)
          return result
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error(`[tool:${t.name}] ${Date.now() - start}ms error:`, message)
          return { error: message }
        }
      },
    })
  }

  return tools
}
