import { z, type ZodSchema } from 'zod'
import type { NfdApiClient } from '@txnlab/nfd-sdk'
import { resolveNfd, reverseResolveNfd, batchReverseResolveNfd } from './handlers'

export interface NfdToolDefinition {
  name: string
  description: string
  parameters: ZodSchema
  handler: (api: NfdApiClient, args: any) => Promise<unknown>
}

export const nfdTools: NfdToolDefinition[] = [
  {
    name: 'resolve_nfd',
    description:
      'Resolve an NFD name (e.g. "vibekit.algo") to its Algorand deposit address. Use this when a user refers to an account by name instead of address.',
    parameters: z.object({
      name: z.string().describe('The NFD name to resolve (e.g. "vibekit.algo")'),
    }),
    handler: async (api, args) => resolveNfd(api, args),
  },
  {
    name: 'reverse_resolve_nfd',
    description:
      'Look up the NFD name associated with an Algorand address. Use this to display a human-readable name for an address.',
    parameters: z.object({
      address: z.string().describe('The Algorand address to look up'),
    }),
    handler: async (api, args) => reverseResolveNfd(api, args),
  },
  {
    name: 'batch_reverse_resolve_nfd',
    description:
      'Look up NFD names for multiple Algorand addresses at once. Prefer this over repeated single reverse_resolve_nfd calls when resolving 2 or more addresses.',
    parameters: z.object({
      addresses: z.array(z.string()).describe('The Algorand addresses to look up'),
    }),
    handler: async (api, args) => batchReverseResolveNfd(api, args),
  },
]
