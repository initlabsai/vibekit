import { z } from 'zod'
import type { ToolDefinition } from '@vibekit/core'
import {
  lookupApplication,
  lookupApplicationLogs,
  searchApplications,
  readGlobalState,
  readLocalState,
  readBoxState,
} from './handlers/index'

export const contractTools: ToolDefinition[] = [
  {
    name: 'lookup_application',
    description: 'Look up a smart contract application by its ID',
    parameters: z.object({
      applicationId: z.number().describe('The application ID to look up'),
    }),
    handler: async ({ algorand, args }) => lookupApplication(algorand, args),
  },
  {
    name: 'search_applications',
    description: 'Search for applications by creator address',
    parameters: z.object({
      limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
      nextToken: z.string().optional().describe('Pagination token'),
      creator: z.string().optional().describe('Filter by creator address'),
    }),
    handler: async ({ algorand, args }) => searchApplications(algorand, args),
  },
  {
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
    handler: async ({ algorand, args }) => lookupApplicationLogs(algorand, args),
  },
  {
    name: 'read_global_state',
    description: 'Read global state from a deployed application. Returns decoded key-value pairs.',
    parameters: z.object({
      appId: z.number().describe('The application ID'),
      appSpec: z.string().optional().describe('Optional app spec JSON for better state decoding'),
    }),
    handler: async ({ algorand, args }) => readGlobalState(algorand, args),
  },
  {
    name: 'read_local_state',
    description: 'Read local state for a specific account from a deployed application.',
    parameters: z.object({
      appId: z.number().describe('The application ID'),
      address: z.string().describe('The account address to read local state for'),
      appSpec: z.string().optional().describe('Optional app spec JSON for better state decoding'),
    }),
    handler: async ({ algorand, args }) => readLocalState(algorand, args),
  },
  {
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
      boxName: z.string().optional().describe('The box name (UTF-8 encoded). Use for simple boxes.'),
      keyPrefix: z.string().optional().describe('BoxMap key prefix. Use with key and keyType.'),
      key: z.union([z.string(), z.number()]).optional().describe('BoxMap key value'),
      keyType: z
        .enum(['uint64', 'address', 'string'])
        .optional()
        .describe('BoxMap key type. Defaults to uint64.'),
      appSpec: z.string().optional().describe('Optional app spec JSON for better value decoding'),
    }),
    handler: async ({ algorand, args }) => readBoxState(algorand, args),
  },
]
