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

/** Resolve `assetid:<id>` avatar markers to image URLs via Pera API. */
async function resolveAssetIdAvatars(obj: unknown): Promise<void> {
  if (!obj || typeof obj !== 'object') return
  const record = obj as Record<string, unknown>

  // Collect all assetid: markers from avatar fields
  const targets: { holder: Record<string, unknown>; id: number }[] = []

  function scan(val: unknown) {
    if (!val || typeof val !== 'object') return
    if (Array.isArray(val)) { val.forEach(scan); return }
    const r = val as Record<string, unknown>
    if (typeof r.avatar === 'string' && r.avatar.startsWith('assetid:')) {
      const id = parseInt(r.avatar.slice(8), 10)
      if (!isNaN(id)) targets.push({ holder: r, id })
    }
    if (typeof r.properties === 'object' && r.properties) {
      const props = r.properties as Record<string, unknown>
      if (typeof props.avatar === 'string' && props.avatar.startsWith('assetid:')) {
        const id = parseInt(props.avatar.slice(8), 10)
        if (!isNaN(id)) targets.push({ holder: props, id })
      }
    }
    if (r.results && Array.isArray(r.results)) r.results.forEach(scan)
  }

  scan(record)
  if (targets.length === 0) return

  const uniqueIds = [...new Set(targets.map((t) => t.id))]
  const peraMap = await getPeraAssetInfoBatch(uniqueIds)

  for (const t of targets) {
    const pera = peraMap.get(t.id)
    t.holder.avatar = pera?.logo ?? undefined
  }
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

          // Inject queried address so the UI can determine tx direction
          if (t.name === 'search_account_transactions') {
            (result as Record<string, unknown>).address = args.address
          }

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

  // get_network_status — rich network dashboard with TPS, supply, block time
  tools.get_network_status = tool({
    description: 'Get network health dashboard: current round, TPS, block time, supply, participation. Use when users ask about network status, health, metrics, or stats.',
    inputSchema: z.object({}),
    execute: async () => {
      const start = Date.now()
      try {
        // Fetch status and supply in parallel
        const [statusRes, supplyRes] = await Promise.all([
          fetch(`${algodUrl}/v2/status`, { headers: { 'X-Algo-API-Token': '' } }),
          fetch(`${algodUrl}/v2/ledger/supply`, { headers: { 'X-Algo-API-Token': '' } }),
        ])
        if (!statusRes.ok) throw new Error(`Algod status failed: ${statusRes.status}`)
        if (!supplyRes.ok) throw new Error(`Algod supply failed: ${supplyRes.status}`)

        const [status, supply] = await Promise.all([statusRes.json(), supplyRes.json()])
        const latestRound = Number(status['last-round'])
        const timeSinceLastRound = Number(status['time-since-last-round']) / 1_000_000_000 // nanoseconds to seconds
        const genesisId = status['genesis-id'] as string ?? ''
        const genesisHash = status['genesis-hash'] as string ?? ''
        const lastVersion = status['last-version'] as string ?? ''
        const catchupTime = Number(status['catchup-time'] ?? 0)
        const totalSupply = Number(supply['total-money']) / 1_000_000
        const onlineStake = Number(supply['online-money']) / 1_000_000
        const participation = onlineStake / totalSupply

        // Sample recent blocks for TPS and block time stats (batched to avoid rate limits)
        const sampleSize = 10
        const batchSize = 5
        const blocks: Awaited<ReturnType<ReturnType<typeof indexer.lookupBlock>['do']>>[] = []
        for (let batch = 0; batch < sampleSize; batch += batchSize) {
          const promises = []
          for (let i = batch; i < Math.min(batch + batchSize, sampleSize); i++) {
            promises.push(indexer.lookupBlock(latestRound - i).do())
          }
          blocks.push(...await Promise.all(promises))
        }

        // Compute block times and TPS from samples
        const blockData = blocks.map((b) => ({
          round: Number(b.round),
          timestamp: Number(b.timestamp),
          txnCount: b.transactions?.length ?? 0,
        })).sort((a, b) => a.round - b.round)

        const blockTimes: number[] = []
        const tpsPerBlock: number[] = []
        for (let i = 1; i < blockData.length; i++) {
          const dt = blockData[i].timestamp - blockData[i - 1].timestamp
          if (dt > 0) {
            blockTimes.push(dt)
            tpsPerBlock.push(blockData[i].txnCount / dt)
          }
        }

        const avgBlockTime = blockTimes.length > 0 ? blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length : 0
        const avgTps = tpsPerBlock.length > 0 ? tpsPerBlock.reduce((a, b) => a + b, 0) / tpsPerBlock.length : 0
        const peakTps = tpsPerBlock.length > 0 ? Math.max(...tpsPerBlock) : 0
        const totalTxns = blockData.reduce((sum, b) => sum + b.txnCount, 0)
        const avgTxnPerBlock = blockData.length > 0 ? totalTxns / blockData.length : 0

        // TPS trend — per-block TPS for the sparkline (oldest to newest)
        const tpsTrend = tpsPerBlock

        console.log(`[tool:get_network_status] ${Date.now() - start}ms`)
        return sanitizeBigInts({
          latestRound,
          timeSinceLastRound: Math.round(timeSinceLastRound * 100) / 100,
          totalSupply,
          onlineStake,
          participation: Math.round(participation * 1000) / 10, // percentage with 1 decimal
          avgBlockTime: Math.round(avgBlockTime * 100) / 100,
          avgTps: Math.round(avgTps * 10) / 10,
          peakTps: Math.round(peakTps),
          avgTxnPerBlock: Math.round(avgTxnPerBlock),
          sampleBlocks: sampleSize,
          tpsTrend,
          blockDetails: blockData.slice(1).map((b, i) => ({
            round: b.round,
            txnCount: b.txnCount,
            blockTime: blockTimes[i] ?? 0,
            tps: Math.round((tpsPerBlock[i] ?? 0) * 10) / 10,
          })),
          totalTxns,
          minBlockTime: blockTimes.length > 0 ? Math.round(Math.min(...blockTimes) * 100) / 100 : 0,
          maxBlockTime: blockTimes.length > 0 ? Math.round(Math.max(...blockTimes) * 100) / 100 : 0,
          genesisId,
          genesisHash,
          consensusVersion: lastVersion,
          catchupTime,
          blockTimeTrend: blockTimes,
        })
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
          await resolveAssetIdAvatars(result)
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
