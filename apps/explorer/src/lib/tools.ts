import { tool, type CoreTool } from 'ai'
import { createIndexerClient, INDEXER_PRESETS, indexerTools, sanitizeBigInts } from '@vibekit/indexer'
import { createNfdApiClient, nfdTools } from '@vibekit/nfd'
import { env } from '@/lib/env'

/** Fetch the latest round from the Algod `/v2/status` endpoint. */
async function getLatestRoundFromAlgod(algodUrl: string): Promise<number> {
  const res = await fetch(`${algodUrl}/v2/status`, {
    headers: { 'X-Algo-API-Token': '' },
  })
  if (!res.ok) throw new Error(`Algod status request failed: ${res.status}`)
  const data = await res.json()
  return Number(data['last-round'])
}

/** Tools that are handled directly by the explorer instead of delegating to the indexer package. */
const OVERRIDDEN_TOOLS = new Set(['get_network_status', 'lookup_block'])

/** Wrap @vibekit/indexer and @vibekit/nfd tools as AI SDK tool definitions. */
export function createExplorerTools() {
  const network = env.ALGORAND_NETWORK
  const preset = INDEXER_PRESETS[network] ?? INDEXER_PRESETS.mainnet
  const url = process.env.ALGORAND_INDEXER_URL ?? preset.url
  const token = process.env.ALGORAND_INDEXER_TOKEN ?? preset.token
  const algodUrl = env.ALGORAND_ALGOD_URL

  const indexer = createIndexerClient(url, token)
  const nfdApi = createNfdApiClient(network)

  const tools: Record<string, CoreTool> = {}

  for (const t of indexerTools) {
    if (OVERRIDDEN_TOOLS.has(t.name)) continue

    tools[t.name] = tool({
      description: t.description,
      parameters: t.parameters,
      execute: async (args) => {
        const start = Date.now()
        try {
          const result = sanitizeBigInts(await t.handler(indexer, args))
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
    parameters: indexerTools.find((t) => t.name === 'get_network_status')!.parameters,
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

  // lookup_block — resolve latest round via Algod when round is omitted
  tools.lookup_block = tool({
    description: 'Look up a block by its round number. If no round is provided, returns the latest block.',
    parameters: indexerTools.find((t) => t.name === 'lookup_block')!.parameters,
    execute: async (args: { round?: number }) => {
      const start = Date.now()
      try {
        const round = args.round ?? (await getLatestRoundFromAlgod(algodUrl))
        const handler = indexerTools.find((t) => t.name === 'lookup_block')!.handler
        const result = sanitizeBigInts(await handler(indexer, { round }))
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
      parameters: t.parameters,
      execute: async (args) => {
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
