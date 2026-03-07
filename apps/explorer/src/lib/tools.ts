import { z } from 'zod'
import { tool, type ToolSet } from 'ai'
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

  // lookup_block — use Algod for latest round, block headers for lightweight response
  tools.lookup_block = tool({
    description: 'Look up a block by its round number. If no round is provided, returns the latest block.',
    inputSchema: z.object({
      round: z.number().nullish().describe('The round number of the block (omit for latest)'),
    }),
    execute: async (args) => {
      const start = Date.now()
      try {
        const round = args.round ?? (await getLatestRoundFromAlgod(algodUrl))
        const headers = await indexer.searchForBlockHeaders().minRound(round).maxRound(round).limit(1).do()
        const block = headers.blocks?.[0]
        if (!block) throw new Error(`Block ${round} not found`)
        const result = sanitizeBigInts({
          round: Number(block.round),
          timestamp: Number(block.timestamp),
          transactionCount: block.transactions?.length ?? 0,
          proposer: block.proposer ? String(block.proposer) : undefined,
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
