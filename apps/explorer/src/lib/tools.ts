import { z } from 'zod'
import { tool, type ToolSet } from 'ai'
import { createIndexerClient, INDEXER_PRESETS, indexerTools, sanitizeBigInts, formatAssetAmount, type FormattedTransaction, type AccountAsset } from '@vibekit/indexer'
import { createNfdApiClient, nfdTools } from '@vibekit/nfd'
import { env } from '@/lib/env'

type IndexerClient = ReturnType<typeof createIndexerClient>

import { LRUCache } from './lru-cache'
import { getPeraAssetInfo, getPeraAssetInfoBatch } from './pera-api'
import { getAccountAssets } from '@vibekit/indexer'

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

          // Enrich asset lookup with Pera data (logo, verification, USD price)
          if (t.name === 'lookup_asset') {
            const assetId = (result as Record<string, unknown>).assetId as number
            if (assetId != null) {
              const pera = await getPeraAssetInfo(assetId)
              if (pera) {
                Object.assign(result as object, {
                  logo: pera.logo,
                  verificationTier: pera.verificationTier,
                  usdValue: pera.usdValue,
                })
              }
            }
          }

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

  // get_account_portfolio — enriched holdings with USD values
  tools.get_account_portfolio = tool({
    description: 'Get an account portfolio with USD values for all holdings. Excludes NFTs by default.',
    inputSchema: z.object({
      address: z.string().describe('Algorand address'),
      includeNfts: z.boolean().optional().default(false).describe('Include NFTs (assets with amount of 1 and no USD value)'),
    }),
    execute: async ({ address, includeNfts }) => {
      const start = Date.now()
      try {
        // 1. Get account info (for ALGO balance)
        const accountRaw = await indexer.lookupAccountByID(address).do()
        const account = sanitizeBigInts(accountRaw)
        const algoBalance =
          Number((account as Record<string, Record<string, unknown>>).account?.amount ?? 0) / 1_000_000

        // Get ALGO USD price from Pera (asset 0)
        const algoPera = await getPeraAssetInfo(0)
        const algoUsdValue = algoPera?.usdValue ? algoBalance * algoPera.usdValue : null

        // 2. Get all assets (paginate up to 200)
        const allAssets: AccountAsset[] = []
        let nextToken: string | undefined
        do {
          const page = await getAccountAssets(indexer, {
            address,
            limit: 100,
            nextToken,
          })
          allAssets.push(...page.assets)
          nextToken = page.nextToken
        } while (nextToken && allAssets.length < 200)

        // 3. Batch enrich with Pera
        const assetIds = allAssets.map((a) => a.assetId as number)
        const peraMap = await getPeraAssetInfoBatch(assetIds)

        // 4. Compute USD values
        let totalValueUsd = algoUsdValue ?? 0
        const enriched = allAssets.map((a) => {
          const pera = peraMap.get(a.assetId as number)
          const amount = parseFloat(String(a.amount ?? '0').replace(/,/g, ''))
          const usdValue = pera?.usdValue ? amount * pera.usdValue : null
          if (usdValue) totalValueUsd += usdValue
          return {
            ...a,
            logo: pera?.logo ?? null,
            verificationTier: pera?.verificationTier ?? 'unverified',
            usdValue,
          }
        })

        // Filter out zero-balance opt-ins and NFTs unless requested
        const filtered = enriched.filter((a) => {
          const raw = parseFloat(String(a.amount ?? '0').replace(/,/g, ''))
          if (raw === 0) return false
          if (!includeNfts && raw === 1 && a.usdValue == null) return false
          return true
        })

        // Sort by USD value desc
        filtered.sort((a, b) => (b.usdValue ?? -1) - (a.usdValue ?? -1))

        console.log(`[tool:get_account_portfolio] ${Date.now() - start}ms`)
        return { address, algoBalance, algoUsdValue, totalValueUsd, assets: filtered }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[tool:get_account_portfolio] ${Date.now() - start}ms error:`, message)
        return { error: message }
      }
    },
  })

  return tools
}
