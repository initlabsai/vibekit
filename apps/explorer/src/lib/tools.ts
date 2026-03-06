import { tool, type CoreTool } from 'ai'
import { createIndexerClient, INDEXER_PRESETS, indexerTools, sanitizeBigInts } from '@vibekit/indexer'
import { createNfdApiClient, nfdTools } from '@vibekit/nfd'

/** Wrap @vibekit/indexer and @vibekit/nfd tools as AI SDK tool definitions. */
export function createExplorerTools() {
  const network = process.env.ALGORAND_NETWORK ?? 'mainnet'
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
        try {
          return sanitizeBigInts(await t.handler(indexer, args))
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error(`[tool:${t.name}]`, message)
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
        try {
          return sanitizeBigInts(await t.handler(nfdApi, args))
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error(`[tool:${t.name}]`, message)
          return { error: message }
        }
      },
    })
  }

  return tools
}
