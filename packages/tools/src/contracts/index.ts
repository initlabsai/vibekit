import { defineTool, ToolError, type AnyTool } from '@initlabs/vibekit-core'
import algosdk from 'algosdk'
import { z } from 'zod'
import { lookupApplication, lookupApplicationLogs } from './handlers/lookup.js'
import { searchApplications } from './handlers/search.js'
import { readBoxState, readGlobalState, readLocalState } from './handlers/state.js'
import { parseAppSpec, substituteTemplateParams } from './lib/app-spec.js'

export { lookupApplication, lookupApplicationLogs, searchApplications }
export { readBoxState, readGlobalState, readLocalState }
export { parseAppSpec, substituteTemplateParams }
export type { FormattedApplication } from './lib/format.js'
export type { StateValue } from './handlers/state.js'

const stateSchema = z.object({
  numByteSlice: z.number(),
  numUint: z.number(),
})

/** Wire shape of lookup_application ('application.detail' view). */
export const formattedApplicationSchema = z.object({
  applicationId: z.number(),
  creator: z.string().optional(),
  globalState: z
    .array(
      z.object({
        key: z.string(),
        value: z.object({
          type: z.number(),
          bytes: z.string().optional().describe('base64-encoded bytes value'),
          uint: z
            .union([z.number(), z.string()])
            .optional()
            .describe('uint64 state value; decimal string when above 2^53'),
        }),
      }),
    )
    .optional(),
  localStateSchema: stateSchema.optional(),
  globalStateSchema: stateSchema.optional(),
})

/** Decoded key-value pair from application state. */
const stateValue = z.object({
  key: z.string().describe('State key: app-spec name when resolvable, else UTF-8 decode of the raw key'),
  keyBase64: z.string().describe('base64 of the exact key bytes'),
  value: z
    .union([z.string(), z.number()])
    .describe('bytes state as UTF-8 text; uint64 state as number, or decimal string above 2^53'),
  valueBase64: z.string().optional().describe('base64 of the exact value bytes (bytes-typed state only)'),
  type: z.enum(['uint', 'bytes']),
})

/** Wire shape of search_applications ('application.list' view). */
export const applicationListSchema = z.object({
  applications: z.array(formattedApplicationSchema),
  nextToken: z.string().optional(),
})

/** Wire shape of lookup_application_logs ('application.logs' view). */
export const applicationLogsSchema = z.object({
  applicationId: z.number(),
  logData: z.array(
    z.object({
      txid: z.string(),
      logs: z.array(z.string()).describe('base64-encoded log bytes'),
    }),
  ),
  nextToken: z.string().optional(),
})

/** Wire shape of read_global_state ('application.state' view). */
export const globalStateSchema = z.object({
  appId: z.number(),
  state: z.array(stateValue),
})

/** Wire shape of read_local_state ('application.state' view). */
export const localStateSchema = z.object({
  appId: z.number(),
  address: z.string(),
  optedIn: z.boolean().describe('false = account is not opted in (state is then empty, not merely unset)'),
  state: z.array(stateValue),
})

/** Wire shape of read_box_state ('application.box' view). */
export const applicationBoxSchema = z.object({
  appId: z.number(),
  boxName: z.string(),
  exists: z.boolean(),
  value: z.string().optional(),
  valueBase64: z.string().optional(),
  size: z.number().optional(),
})

/** Wire shape of app_get_info ('json' view). */
export const appInfoSchema = z.object({
  appId: z.number(),
  creator: z.string(),
  appAddress: z.string(),
  globalInts: z.number().optional(),
  globalBytes: z.number().optional(),
  localInts: z.number().optional(),
  localBytes: z.number().optional(),
  extraProgramPages: z.number().optional(),
  approvalProgramSize: z.number(),
  clearProgramSize: z.number(),
})

/** Wire shape of app_list_methods ('table' view). */
export const appMethodsSchema = z.object({
  name: z.string().optional(),
  methods: z.array(
    z.object({
      name: z.string(),
      signature: z.string(),
      description: z.string().optional(),
      args: z.array(
        z.object({
          name: z.string().optional(),
          type: z.string(),
          description: z.string().optional(),
        }),
      ),
      returns: z.object({ type: z.string(), description: z.string().optional() }),
    }),
  ),
})

export { contractWriteTools } from './tools-write.js'

export const contractTools: AnyTool[] = [
  defineTool({
    name: 'lookup_application',
    description: 'Look up a smart contract application by its ID',
    parameters: z.object({
      applicationId: z.number().describe('The application ID to look up'),
    }),
    output: formattedApplicationSchema,
    view: 'application.detail',
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
    output: applicationListSchema,
    view: 'application.list',
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
    output: applicationLogsSchema,
    view: 'application.logs',
    handler: async (ctx, args) => lookupApplicationLogs(ctx, args),
  }),
  defineTool({
    name: 'read_global_state',
    description: 'Read global state from a deployed application. Returns decoded key-value pairs.',
    parameters: z.object({
      appId: z.number().describe('The application ID'),
      appSpec: z.string().optional().describe('Optional app spec JSON for better state decoding'),
    }),
    output: globalStateSchema,
    view: 'application.state',
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
    output: localStateSchema,
    view: 'application.state',
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
    output: applicationBoxSchema,
    view: 'application.box',
    handler: async (ctx, args) => readBoxState(ctx, args),
  }),
  defineTool({
    name: 'app_get_info',
    description:
      "Get an application's current parameters from algod: creator, schema, program sizes, extra pages.",
    parameters: z.object({ appId: z.number().describe('The application ID') }),
    output: appInfoSchema,
    view: 'json',
    handler: async (ctx, args) => {
      const app = await ctx.algod.getApplicationByID(BigInt(args.appId)).do()
      const params = app.params
      if (!params) {
        throw new ToolError('APP_NOT_FOUND', `Application ${args.appId} has no parameters`)
      }
      return {
        appId: Number(app.id),
        creator: String(params.creator),
        appAddress: String(algosdk.getApplicationAddress(BigInt(args.appId))),
        globalInts: params.globalStateSchema ? Number(params.globalStateSchema.numUint) : undefined,
        globalBytes: params.globalStateSchema
          ? Number(params.globalStateSchema.numByteSlice)
          : undefined,
        localInts: params.localStateSchema ? Number(params.localStateSchema.numUint) : undefined,
        localBytes: params.localStateSchema
          ? Number(params.localStateSchema.numByteSlice)
          : undefined,
        extraProgramPages:
          params.extraProgramPages !== undefined ? Number(params.extraProgramPages) : undefined,
        approvalProgramSize: params.approvalProgram?.length ?? 0,
        clearProgramSize: params.clearStateProgram?.length ?? 0,
      }
    },
  }),
  defineTool({
    name: 'app_list_methods',
    description: 'List the ABI methods of an app spec: signatures, args, returns, descriptions.',
    parameters: z.object({
      appSpec: z.string().describe('ARC-56 or ARC-32 app spec JSON as a string'),
    }),
    output: appMethodsSchema,
    view: 'table',
    handler: async (_ctx, args) => {
      const spec = parseAppSpec(args.appSpec)
      return { name: spec.name, methods: spec.methods }
    },
  }),
] as AnyTool[]
