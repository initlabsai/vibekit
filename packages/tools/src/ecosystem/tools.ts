import { z } from 'zod'
import type { ToolDefinition } from '@vibekit/core'
import { projects, ECOSYSTEM_CATEGORIES, type EcosystemCategory } from './data'

const categoryEnum = z.enum(['defi', 'wallets', 'bridges', 'explorers', 'impact', 'nfts', 'rwa'])

const projectNames = projects.map((p) => p.name).join(', ')
const categoryList = Object.entries(ECOSYSTEM_CATEGORIES)
  .map(([key, label]) => `${key} (${label})`)
  .join(', ')

export const ecosystemTools: ToolDefinition[] = [
  {
    name: 'search_ecosystem',
    description: `Search the Algorand ecosystem directory of projects and protocols. Categories: ${categoryList}. Known projects: ${projectNames}. At least one of category or query is required.`,
    parameters: z.object({
      category: categoryEnum
        .optional()
        .describe(
          'Filter by category. Use alone only when the user wants to browse an entire category.'
        ),
      query: z
        .string()
        .optional()
        .describe(
          'Search term to filter by name, description, or features. Always provide when the user asks about a specific topic, not just a category.'
        ),
    }),
    handler: async ({ args }) => {
      const { category, query } = args as { category?: EcosystemCategory; query?: string }

      if (!category && !query) {
        return { error: 'At least one of category or query is required' }
      }

      let results = projects

      if (category) {
        results = results.filter((p) => p.category === category)
      }

      if (query) {
        const words = query.toLowerCase().split(/\s+/).filter(Boolean)
        const matches = (text: string) => {
          const t = text.toLowerCase()
          return words.some((w) => t.includes(w) || w.includes(t))
        }
        results = results.filter(
          (p) =>
            matches(p.name) ||
            matches(p.id) ||
            matches(p.description) ||
            p.features.some((f) => matches(f))
        )
      }

      return { projects: results, category, query }
    },
  },
]
