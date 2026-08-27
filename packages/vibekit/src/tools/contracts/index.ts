import { defineTool, ToolError, type AnyTool } from '../../core/index.js'
import algosdk from 'algosdk'
import { z } from 'zod'
import { lookupApplication, lookupApplicationLogs } from './lookup.js'
import {
  estimateProgramTokens,
  getApplicationProgram,
  programHash,
  PROGRAM_PAGE_LINES,
} from './program.js'
import { analyzeTeal, labelSelectors } from './teal.js'
import { searchApplications } from './search.js'
import { listApplicationBoxes, readBoxState, readGlobalState, readLocalState } from './state.js'
import {
  appSpecParams,
  normalizeAppSpec,
  parseAppSpec,
  requireAppSpec,
  substituteTemplateParams,
  withAppSpecFile,
} from './app-spec.js'

import {
  appInfoSchema,
  appMethodsSchema,
  applicationBoxSchema,
  applicationBoxesSchema,
  applicationListSchema,
  applicationLogsSchema,
  applicationStateSchema,
  formattedApplicationSchema,
  applicationProgramSchema,
} from './schemas.js'

export * from './schemas.js'
export {
  analyzeTeal,
  labelSelectors,
  estimateProgramTokens,
  getApplicationProgram,
  programHash,
  PROGRAM_PAGE_LINES,
}
export type { TealAnalysis, OnCompletionAction, LabelledMethod } from './teal.js'
export type { ApplicationProgram } from './program.js'
export { lookupApplication, lookupApplicationLogs, searchApplications }
export { listApplicationBoxes, readBoxState, readGlobalState, readLocalState }
export { parseAppSpec, substituteTemplateParams }
export { detectAppSpecFormat, tryNormalizeAppSpec } from './app-spec.js'
export { normalizeAppSpec }
export type { AppSpecFormat, NormalizedAppSpec, ParsedAppSpec, ParsedMethod } from './app-spec.js'
export { toolsFromArc56, toolsWithMethods, toolArgsFor, describeCall } from './from-arc56.js'
export type { GeneratedAppTool, ToolsFromArc56Options } from './from-arc56.js'
export { decodeAppCall, decodeAppCallForApp, enrichTransactionsWithAbi } from './abi.js'
export type { DecodedAppCall, DecodedAbiValue } from './abi.js'
export type { FormattedApplication } from './format.js'
export type { StateValue } from './state.js'

export { contractWriteTools, DEPLOYER_NOTE_PREFIX, deployerNote } from './tools-write.js'

export const contractTools: AnyTool[] = [
  defineTool({
    name: 'lookup_application',
    description:
      'Look up an application by its ID via the indexer: creator, global state, schemas. get_application_info is the algod view; call one, not both.',
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
      ...appSpecParams,
    }),
    output: applicationStateSchema,
    view: 'application.state',
    handler: async (ctx, args) => readGlobalState(ctx, await withAppSpecFile(ctx, args)),
  }),
  defineTool({
    name: 'read_local_state',
    description: 'Read local state for a specific account from a deployed application.',
    parameters: z.object({
      appId: z.number().describe('The application ID'),
      address: z.string().describe('The account address to read local state for'),
      ...appSpecParams,
    }),
    output: applicationStateSchema,
    view: 'application.state',
    handler: async (ctx, args) => readLocalState(ctx, await withAppSpecFile(ctx, args)),
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
      ...appSpecParams,
    }),
    output: applicationBoxSchema,
    view: 'application.box',
    handler: async (ctx, args) => readBoxState(ctx, await withAppSpecFile(ctx, args)),
  }),
  defineTool({
    name: 'list_application_boxes',
    description:
      'List the boxes a deployed application holds — names only. Follow up with read_box_state to fetch a value.',
    parameters: z.object({
      appId: z.number().describe('The application ID'),
      limit: z.number().optional().describe('Max boxes to return (default 100, max 1000)'),
    }),
    output: applicationBoxesSchema,
    view: 'application.boxes',
    handler: async (ctx, args) => listApplicationBoxes(ctx, args),
  }),
  defineTool({
    name: 'get_application_info',
    description:
      "An application's current parameters straight from algod: creator, schema, program sizes, extra pages. lookup_application is the indexer view; call one, not both.",
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
    name: 'get_application_program',
    description:
      "Fetch and disassemble an application's on-chain program into TEAL, with static facts: version, entrypoints (ARC-4 selectors or string-routed names), state keys, which transaction fields it reads, inner transactions, OnCompletion handling. Use to explain what a smart contract does. Not a security audit: the facts describe behavior, never safety. Large result — call it once; page with fromLine/toLine only when the facts and first page are not enough.",
    parameters: z.object({
      applicationId: z.number().describe('The application ID'),
      program: z
        .enum(['approval', 'clear'])
        .optional()
        .describe('Which program (default approval)'),
      fromLine: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(`First TEAL line to return (default 1; ${PROGRAM_PAGE_LINES} lines a page)`),
      toLine: z.number().int().positive().optional().describe('Last TEAL line to return'),
    }),
    output: applicationProgramSchema,
    view: 'application.program',
    expensive: true,
    handler: async (ctx, args) => getApplicationProgram(ctx, args),
  }),
  defineTool({
    name: 'list_app_spec_methods',
    description: 'List the ABI methods of an app spec: signatures, args, returns, descriptions.',
    parameters: z.object(appSpecParams),
    output: appMethodsSchema,
    view: 'table',
    handler: async (ctx, args) => {
      const spec = normalizeAppSpec(requireAppSpec(await withAppSpecFile(ctx, args)))
      return { name: spec.name, methods: spec.methods }
    },
  }),
]
