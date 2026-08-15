import { defineTool, type AnyTool } from '@initlabs/core'
import { z } from 'zod'
import { lookupApplication, lookupApplicationLogs } from './handlers/lookup.js'
import { searchApplications } from './handlers/search.js'
import { readBoxState, readGlobalState, readLocalState } from './handlers/state.js'

export { lookupApplication, lookupApplicationLogs, searchApplications }
export { readBoxState, readGlobalState, readLocalState }
export type { FormattedApplication } from './lib/format.js'
export type { StateValue } from './handlers/state.js'

const stateSchema = z.object({
  numByteSlice: z.number(),
  numUint: z.number(),
})

const formattedApplication = z.object({
  applicationId: z.number(),
  creator: z.string().optional(),
  globalState: z
    .array(
      z.object({
        key: z.string(),
        value: z.object({
          type: z.number(),
          bytes: z.string().optional(),
          uint: z.number().optional(),
        }),
      }),
    )
    .optional(),
  localStateSchema: stateSchema.optional(),
  globalStateSchema: stateSchema.optional(),
})

/** Decoded key-value pair from application state. uint values may exceed 2^53 (bigint). */
const stateValue = z.object({
  key: z.string(),
  value: z.union([z.string(), z.number(), z.bigint()]),
  type: z.enum(['uint', 'bytes']),
})

export const contractTools: AnyTool[] = [
  defineTool({
    name: 'lookup_application',
    description: 'Look up a smart contract application by its ID',
    parameters: z.object({
      applicationId: z.number().describe('The application ID to look up'),
    }),
    output: formattedApplication,
    display: 'json',
    handler: async (ctx, args) => lookupApplication(ctx, args),
  }),
  defineTool({
    name: 'search_applications',
    description: 'Search for applications by creator address',
    parameters: z.object({
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      creator: z.string().optional().describe('Filter by creator address'),
    }),
    output: z.object({
      applications: z.array(formattedApplication),
      nextToken: z.string().optional(),
    }),
    display: 'table',
    handler: async (ctx, args) => searchApplications(ctx, args),
  }),
  defineTool({
    name: 'lookup_application_logs',
    description: 'Get log messages for a specific application',
    parameters: z.object({
      applicationId: z.number().describe('The application ID'),
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      txid: z.string().optional().describe('Filter by transaction ID'),
      minRound: z.number().optional().describe('Include logs at or after this round'),
      maxRound: z.number().optional().describe('Include logs at or before this round'),
    }),
    output: z.object({
      applicationId: z.number(),
      logData: z.array(z.unknown()),
      nextToken: z.string().optional(),
    }),
    display: 'table',
    handler: async (ctx, args) => lookupApplicationLogs(ctx, args),
  }),
  defineTool({
    name: 'read_global_state',
    description: 'Read global state from a deployed application. Returns decoded key-value pairs.',
    parameters: z.object({
      appId: z.number().describe('The application ID'),
      appSpec: z.string().optional().describe('Optional app spec JSON for better state decoding'),
    }),
    output: z.object({
      appId: z.number(),
      state: z.array(stateValue),
    }),
    display: 'json',
    handler: async (ctx, args) => readGlobalState(ctx, args),
  }),
  defineTool({
    name: 'read_local_state',
    description: 'Read local state for a specific account from a deployed application.',
    parameters: z.object({
      appId: z.number().describe('The application ID'),
      address: z.string().describe('The account address to read local state for'),
      appSpec: z.string().optional().describe('Optional app spec JSON for better state decoding'),
    }),
    output: z.object({
      appId: z.number(),
      address: z.string(),
      state: z.array(stateValue),
    }),
    display: 'json',
    handler: async (ctx, args) => readLocalState(ctx, args),
  }),
  defineTool({
    name: 'read_box_state',
    description: `Read a box value from a deployed application. Supports simple box names and BoxMap compound keys.

Modes:
1. Simple box: Provide boxName for UTF-8 encoded box names
2. BoxMap: Provide keyPrefix + key + keyType for compound BoxMap keys

Examples:
- Simple box: { "appId": 123, "boxName": "myBox" }
- BoxMap with uint64 key: { "appId": 123, "keyPrefix": "boxMap", "key": 1, "keyType": "uint64" }
- BoxMap with address key: { "appId": 123, "keyPrefix": "users", "key": "ABC123...", "keyType": "address" }`,
    parameters: z.object({
      appId: z.number().describe('The application ID'),
      boxName: z
        .string()
        .optional()
        .describe('The box name (UTF-8 encoded). Use for simple boxes.'),
      keyPrefix: z.string().optional().describe('BoxMap key prefix. Use with key and keyType.'),
      key: z.union([z.string(), z.number()]).optional().describe('BoxMap key value'),
      keyType: z
        .enum(['uint64', 'address', 'string'])
        .optional()
        .describe('BoxMap key type. Defaults to uint64.'),
      appSpec: z.string().optional().describe('Optional app spec JSON for better value decoding'),
    }),
    output: z.object({
      appId: z.number(),
      boxName: z.string(),
      exists: z.boolean(),
      value: z.string().optional(),
      valueBase64: z.string().optional(),
      size: z.number().optional(),
    }),
    display: 'json',
    handler: async (ctx, args) => readBoxState(ctx, args),
  }),
] as AnyTool[]
