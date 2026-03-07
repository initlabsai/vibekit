import { tool, type CoreTool } from 'ai'
import { createIndexerClient, INDEXER_PRESETS, indexerTools, sanitizeBigInts } from '@vibekit/indexer'
import { createNfdApiClient, nfdTools } from '@vibekit/nfd'
import { env } from '@/lib/env'

/** Wrap @vibekit/indexer and @vibekit/nfd tools as AI SDK tool definitions. */
export function createExplorerTools() {
  const network = env.ALGORAND_NETWORK
  const preset = INDEXER_PRESETS[network] ?? INDEXER_PRESETS.mainnet
  const url = process.env.ALGORAND_INDEXER_URL ?? preset.url
  const token = process.env.ALGORAND_INDEXER_TOKEN ?? preset.token

  const indexer = createIndexerClient(url, token)
  const nfdApi = createNfdApiClient(network)

  const tools: Record<string, CoreTool> = {}

  for (const t of indexerTools) {
    tools[t.name] = tool({
      description: t.description,
      parameters: t.parameters,
      execute: async (args) => {
        const start = Date.now()
        try {
          // TEMP: hardcode block 59024711 for lookup_block to isolate the issue
          if (t.name === 'lookup_block') {
            const result = sanitizeBigInts(await t.handler(indexer, { round: 59024711 }))
            console.log(`[tool:${t.name}] ${Date.now() - start}ms (hardcoded round)`)
            return result
          }

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
