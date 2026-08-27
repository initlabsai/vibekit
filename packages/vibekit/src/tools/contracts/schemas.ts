import { z } from 'zod'

const stateSchema = z.object({
  numByteSlice: z.number(),
  numUint: z.number(),
})

/** Wire shape of lookup_application ('application.detail' view). */
export const formattedApplicationSchema = z.object({
  applicationId: z.number(),
  applicationLabel: z.string().optional().describe('Known protocol contract; absent means unknown — say so, never guess'),
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

/** Wire shape of list_application_boxes ('application.boxes' view). */
export const applicationBoxesSchema = z.object({
  appId: z.number(),
  boxes: z.array(
    z.object({
      name: z.string().describe('Box name: utf-8 when printable, else base64'),
      nameBase64: z.string().describe('base64 of the exact box-name bytes'),
    }),
  ),
  truncated: z.boolean().optional().describe('True when more boxes exist beyond the returned page'),
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

/** Wire shape of read_global_state and read_local_state ('application.state' view). */
export const applicationStateSchema = z.object({
  appId: z.number(),
  scope: z.enum(['global', 'local']),
  address: z.string().optional().describe('Local scope only: the account whose state this is'),
  optedIn: z
    .boolean()
    .optional()
    .describe('Local scope only. false = not opted in (state is then empty, not merely unset)'),
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

const onCompletionActionSchema = z.enum([
  'NoOp',
  'OptIn',
  'CloseOut',
  'ClearState',
  'UpdateApplication',
  'DeleteApplication',
])

/** Wire shape of get_application_program ('application.program' view). */
export const applicationProgramSchema = z.object({
  applicationId: z.number(),
  program: z.enum(['approval', 'clear']),
  bytes: z.number(),
  programHash: z.string().describe('sha512/256 of the bytecode, hex'),
  totalLines: z.number(),
  fromLine: z.number(),
  toLine: z.number(),
  teal: z.string().describe('Disassembled TEAL, lines fromLine..toLine'),
  analysis: z.object({
    version: z.number().optional(),
    entrypoints: z.array(z.string()).describe('Constants compared against ApplicationArgs 0: ARC-4 selectors as 0x-hex, string method names as text'),
    selectors: z.array(z.string()).describe('The ARC-4 subset of entrypoints, bare hex'),
    arc4Returns: z.boolean().describe('Logs return values behind the ARC-4 prefix 0x151f7c75 (sha512/256("return")[:4])'),
    strings: z.array(z.string()),
    stateKeys: z.object({ global: z.array(z.string()), local: z.array(z.string()), box: z.array(z.string()) }),
    guards: z.object({ rekey: z.boolean(), closeRemainder: z.boolean(), assetClose: z.boolean() }),
    innerTransactions: z.number(),
    onCompletion: z.array(z.object({ action: onCompletionActionSchema, outcome: z.enum(['handled', 'rejected']) })),
  }),
  methods: z.array(
    z.object({
      selector: z.string(),
      name: z.string().optional().describe('Known only when an app spec is available'),
      signature: z.string().optional(),
      args: z.array(z.object({ name: z.string().optional(), type: z.string() })).optional(),
      returns: z.string().optional(),
      readonly: z.boolean().optional(),
      description: z.string().optional(),
    }),
  ),
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
