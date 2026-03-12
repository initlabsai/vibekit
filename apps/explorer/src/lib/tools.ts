import { z } from 'zod'
import { tool, type ToolSet } from 'ai'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { sanitizeBigInts, formatAssetAmount, indexerSemaphore as indexerSem, type ToolDefinition, type ResolveSenderFn, type ResolveAppSpecFn } from '@vibekit/core'
import { networkTools } from '@vibekit/network'
import { accountTools, getAccountAssets, type AccountAsset } from '@vibekit/accounts'
import { assetTools } from '@vibekit/assets'
import { contractTools } from '@vibekit/contracts'
import { transactionTools, type FormattedTransaction } from '@vibekit/transactions'
import { createNfdApiClient, nfdTools } from '@vibekit/nfd'
import { ecosystemTools } from '@vibekit/ecosystem'
import { INDEXER_PRESETS, ALGOD_PRESETS } from '@vibekit/core'
import { env } from '@/lib/env'

import { LRUCache } from './lru-cache'
import { getPeraAssetInfo, getPeraAssetInfoBatch } from './pera-api'

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

async function enrichTransactions(algorand: AlgorandClient, txns: FormattedTransaction[]): Promise<void> {
  const ids = collectAssetIds(txns)
  const uncached = [...ids].filter((id) => !assetCache.has(id))

  if (uncached.length > 0) {
    const results = await Promise.allSettled(
      uncached.map(async (id) => {
        const res = await indexerSem.run(() => algorand.client.indexer.lookupAssetByID(id).do())
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

const noResolveSender: ResolveSenderFn = () => { throw new Error('Write tools not available in explorer') }
const noResolveAppSpec: ResolveAppSpecFn = async () => { throw new Error('Write tools not available in explorer') }

/** All domain package tools combined. */
const allDomainTools: ToolDefinition[] = [
  ...networkTools,
  ...accountTools.filter((t) => t.name !== 'get_account_portfolio'),
  ...assetTools,
  ...contractTools,
  ...transactionTools,
  ...ecosystemTools,
]

/** Wrap domain package tools and @vibekit/nfd tools as AI SDK tool definitions. */
export function createExplorerTools(): ToolSet {
  const network = env.ALGORAND_NETWORK
  const preset = INDEXER_PRESETS[network] ?? INDEXER_PRESETS.mainnet
  const indexerUrl = process.env.ALGORAND_INDEXER_URL ?? preset.url
  const indexerToken = process.env.ALGORAND_INDEXER_TOKEN ?? preset.token
  const algodPreset = ALGOD_PRESETS[network] ?? ALGOD_PRESETS.mainnet
  const algodUrl = process.env.ALGORAND_ALGOD_URL ?? algodPreset.url

  const algorand = AlgorandClient.fromConfig({
    algodConfig: { server: algodUrl, port: '', token: '' },
    indexerConfig: { server: indexerUrl, port: '', token: indexerToken },
  })

  const nfdApi = createNfdApiClient(network)

  const tools: ToolSet = {}

  for (const t of allDomainTools) {
    tools[t.name] = tool({
      description: t.description,
      inputSchema: t.parameters,
      execute: async (args: Record<string, unknown>) => {
        const start = Date.now()
        try {
          const raw = await t.handler({ algorand, args, resolveSender: noResolveSender, resolveAppSpec: noResolveAppSpec })

          // Enrich transaction results with asset metadata
          if (TRANSACTION_TOOLS.has(t.name)) {
            const txns = extractTransactions(raw)
            if (txns.length > 0) await enrichTransactions(algorand, txns)
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
        const accountRaw = await algorand.client.indexer.lookupAccountByID(address).do()
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
          const page = await getAccountAssets(algorand, {
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
