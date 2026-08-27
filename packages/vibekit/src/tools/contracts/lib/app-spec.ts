/**
 * ARC-56 / ARC-32 / ARC-4 app spec parsing for deploy, method listing, and
 * local spec discovery. Every format normalizes to the ARC-56 subset the
 * toolkit consumes; TEAL sources are base64 in ARC-56 and ARC-32 alike.
 */
import { base64ToBytes, ToolError } from '../../../core/index.js'
import algosdk from 'algosdk'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'

export type AppSpecFormat = 'arc56' | 'arc32' | 'arc4'

/**
 * The two ways a tool can receive an app spec. The path form is what agents
 * should use: the spec is read here, so a 10 KB artifact never has to be
 * re-typed into a tool call.
 */
export const appSpecParams = {
  appSpecPath: z
    .string()
    .optional()
    .describe(
      'Path to the ARC-56/ARC-32 app spec file, e.g. artifacts/HelloWorld.arc56.json. Preferred whenever the spec exists as a file — it is read here, nothing to paste.',
    ),
  appSpec: z
    .string()
    .optional()
    .describe(
      'The app spec JSON as a string. Use only when the spec is not available as a file (then appSpecPath cannot apply).',
    ),
}

/** Resolves appSpecPath into appSpec; an explicit appSpec wins. */
export async function withAppSpecFile<T extends { appSpec?: string; appSpecPath?: string }>(
  args: T,
): Promise<T> {
  if (args.appSpec !== undefined || args.appSpecPath === undefined) return args
  try {
    return { ...args, appSpec: await readFile(args.appSpecPath, 'utf8') }
  } catch (error: unknown) {
    throw new ToolError(
      'APP_SPEC_NOT_FOUND',
      `Could not read the app spec at ${args.appSpecPath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/** The spec string for tools that cannot work without one. */
export function requireAppSpec(args: { appSpec?: string; appSpecPath?: string }): string {
  if (args.appSpec === undefined) {
    throw new ToolError(
      'APP_SPEC_REQUIRED',
      'Pass appSpecPath (the built artifact, preferred) or appSpec.',
    )
  }
  return args.appSpec
}

export interface ParsedMethod {
  name: string
  signature: string
  description?: string
  args: Array<{ name?: string; type: string; description?: string }>
  returns: { type: string; description?: string }
  /** ARC-22/ARC-56: a simulate-only method; omitted means a write. */
  readonly?: boolean
}

/** The ARC-56 subset VibeKit consumes, whatever format the file arrived in. */
export interface NormalizedAppSpec {
  format: AppSpecFormat
  name: string
  description?: string
  methods: ParsedMethod[]
  schema: { globalInts: number; globalBytes: number; localInts: number; localBytes: number }
  /** Base64 TEAL as in ARC-56 `source`; absent for methods-only ARC-4 files. */
  source?: { approval?: string; clear?: string }
  byteCode?: { approval?: string; clear?: string }
  /** Deploy-time TMPL_ variable names (prefix stripped), declared or scanned. */
  templateVariables: string[]
  /** ARC-56 named state keys by scope; absent for ARC-32/ARC-4 files. */
  stateKeys?: Record<'global' | 'local' | 'box', Record<string, StateKeyInfo>>
  /** ARC-56 OnCompletes accepted by bare (non-ABI) create and call transactions. */
  bareActions?: { create: string[]; call: string[] }
}

export interface StateKeyInfo {
  keyType: string
  valueType: string
  /** base64 key bytes. */
  key: string
  description?: string
}

export interface ParsedAppSpec {
  name?: string
  approvalTeal?: string
  clearTeal?: string
  approvalByteCode?: Uint8Array
  clearByteCode?: Uint8Array
  schema: { globalInts: number; globalBytes: number; localInts: number; localBytes: number }
  methods: ParsedMethod[]
}

const methodArgSchema = z.object({
  type: z.string().min(1),
  name: z.string().optional(),
  desc: z.string().optional(),
  description: z.string().optional(),
})

const methodSchema = z.object({
  name: z.string().min(1),
  desc: z.string().optional(),
  description: z.string().optional(),
  readonly: z.boolean().optional(),
  args: z.array(methodArgSchema).optional(),
  returns: z
    .object({
      type: z.string().min(1),
      desc: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
})

const arc4ContractSchema = z.object({
  name: z.string().min(1),
  desc: z.string().optional(),
  methods: z.array(methodSchema),
})

const sourceSchema = z.object({ approval: z.string().optional(), clear: z.string().optional() })

const count = z.number().int().nonnegative()

const stateKeySchema = z.object({
  keyType: z.string(),
  valueType: z.string(),
  key: z.string(),
  desc: z.string().optional(),
})
const stateKeysSchema = z.object({
  global: z.record(z.string(), stateKeySchema).optional(),
  local: z.record(z.string(), stateKeySchema).optional(),
  box: z.record(z.string(), stateKeySchema).optional(),
})

const arc56Schema = arc4ContractSchema.extend({
  state: z
    .object({
      schema: z
        .object({
          global: z.object({ ints: count.optional(), bytes: count.optional() }).optional(),
          local: z.object({ ints: count.optional(), bytes: count.optional() }).optional(),
        })
        .optional(),
      keys: stateKeysSchema.optional(),
    })
    .optional(),
  bareActions: z
    .object({ create: z.array(z.string()).optional(), call: z.array(z.string()).optional() })
    .optional(),
  source: sourceSchema.optional(),
  byteCode: sourceSchema.optional(),
  templateVariables: z.record(z.string(), z.unknown()).optional(),
})

const arc32Schema = z.object({
  contract: arc4ContractSchema,
  state: z
    .object({
      global: z
        .object({ num_uints: count.optional(), num_byte_slices: count.optional() })
        .optional(),
      local: z
        .object({ num_uints: count.optional(), num_byte_slices: count.optional() })
        .optional(),
    })
    .optional(),
  source: sourceSchema.optional(),
  byteCode: sourceSchema.optional(),
})

/** Keys that only an ARC-56 file carries; a bare ARC-4 contract has none of them. */
const ARC56_MARKERS = [
  'arcs',
  'structs',
  'state',
  'source',
  'byteCode',
  'sourceInfo',
  'templateVariables',
  'bareActions',
  'compilerInfo',
] as const

/**
 * Structural format sniff on parsed JSON; undefined means "not an app spec".
 * ARC-32 wraps its ARC-4 contract under `contract`; ARC-56 and ARC-4 both put
 * `name`/`methods` at the top level and are told apart by ARC-56-only keys.
 */
export function detectAppSpecFormat(value: unknown): AppSpecFormat | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  if (typeof record['contract'] === 'object' && record['contract'] !== null) return 'arc32'
  if (typeof record['name'] !== 'string' || !Array.isArray(record['methods'])) return undefined
  return ARC56_MARKERS.some((key) => key in record) ? 'arc56' : 'arc4'
}

function invalid(detail: string): ToolError {
  return new ToolError('INVALID_APP_SPEC', detail)
}

type RawMethod = z.infer<typeof methodSchema>

/**
 * ARC-4/ARC-32 methods go through algosdk's ABIContract so bad ABI types are
 * rejected and signatures are canonical. ARC-56 keeps a plain string join:
 * its args may use AVM types ABIContract does not model.
 */
function methodsViaAbiContract(name: string, rawMethods: RawMethod[]): ParsedMethod[] {
  let abi: algosdk.ABIContract
  try {
    abi = new algosdk.ABIContract({
      name,
      methods: rawMethods.map((method) => ({
        name: method.name,
        desc: method.desc ?? method.description,
        readonly: method.readonly,
        args: (method.args ?? []).map((arg) => ({
          type: arg.type,
          name: arg.name,
          desc: arg.desc ?? arg.description,
        })),
        returns: {
          type: method.returns?.type ?? 'void',
          desc: method.returns?.desc ?? method.returns?.description,
        },
      })),
    })
  } catch (error) {
    throw invalid(
      `appSpec contract is not valid ARC-4: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  return abi.methods.map((method, index) => ({
    name: method.name,
    signature: method.getSignature(),
    description: method.description,
    args: method.args.map((arg) => ({
      name: arg.name,
      type: String(arg.type),
      description: arg.description,
    })),
    returns: { type: String(method.returns.type), description: method.returns.description },
    ...(rawMethods[index]?.readonly ? { readonly: true } : {}),
  }))
}

function methodsVerbatim(rawMethods: RawMethod[]): ParsedMethod[] {
  return rawMethods.map((method) => {
    const args = (method.args ?? []).map((arg) => ({
      name: arg.name,
      type: arg.type,
      description: arg.desc ?? arg.description,
    }))
    const returns = {
      type: method.returns?.type ?? 'void',
      description: method.returns?.desc ?? method.returns?.description,
    }
    return {
      name: method.name,
      signature: `${method.name}(${args.map((arg) => arg.type).join(',')})${returns.type}`,
      description: method.desc ?? method.description,
      args,
      returns,
      ...(method.readonly ? { readonly: true } : {}),
    }
  })
}

function decodeTeal(base64Source: string | undefined): string | undefined {
  if (!base64Source) return undefined
  return new TextDecoder().decode(base64ToBytes(base64Source))
}

function scanTemplateVariables(
  source: { approval?: string; clear?: string } | undefined,
): string[] {
  if (!source) return []
  const names = new Set<string>()
  for (const encoded of [source.approval, source.clear]) {
    let teal: string | undefined
    try {
      teal = decodeTeal(encoded)
    } catch {
      continue // not base64 — templates stay best-effort, the compile step reports real errors
    }
    for (const match of teal?.matchAll(/TMPL_([A-Z0-9_]+)/g) ?? []) names.add(match[1]!)
  }
  return [...names].sort()
}

function stateKeysOf(
  keys: Record<string, z.infer<typeof stateKeySchema>> | undefined,
): Record<string, StateKeyInfo> {
  return Object.fromEntries(
    Object.entries(keys ?? {}).map(([name, { keyType, valueType, key, desc }]) => [
      name,
      { keyType, valueType, key, ...(desc === undefined ? {} : { description: desc }) },
    ]),
  )
}

function zodDetail(error: z.ZodError): string {
  const first = error.issues[0]
  return first ? `${first.path.join('.') || '(root)'}: ${first.message}` : 'invalid shape'
}

/**
 * Parses and normalizes an app spec: ARC-56 natively, ARC-32 and bare ARC-4
 * contract JSON converted best-effort to the same ARC-56 subset. Throws
 * ToolError(INVALID_APP_SPEC) on anything else.
 */
export function normalizeAppSpec(appSpecJson: string): NormalizedAppSpec {
  let raw: unknown
  try {
    raw = JSON.parse(appSpecJson)
  } catch {
    throw invalid('appSpec is not valid JSON')
  }
  const format = detectAppSpecFormat(raw)
  if (!format) throw invalid('appSpec is not an ARC-56, ARC-32, or ARC-4 app spec')

  if (format === 'arc56') {
    const parsed = arc56Schema.safeParse(raw)
    if (!parsed.success)
      throw invalid(`appSpec is not a valid ARC-56 file — ${zodDetail(parsed.error)}`)
    const spec = parsed.data
    const declared = spec.templateVariables ? Object.keys(spec.templateVariables).sort() : []
    return {
      format,
      name: spec.name,
      description: spec.desc,
      methods: methodsVerbatim(spec.methods),
      schema: {
        globalInts: spec.state?.schema?.global?.ints ?? 0,
        globalBytes: spec.state?.schema?.global?.bytes ?? 0,
        localInts: spec.state?.schema?.local?.ints ?? 0,
        localBytes: spec.state?.schema?.local?.bytes ?? 0,
      },
      source: spec.source,
      byteCode: spec.byteCode,
      templateVariables: declared.length > 0 ? declared : scanTemplateVariables(spec.source),
      stateKeys: {
        global: stateKeysOf(spec.state?.keys?.global),
        local: stateKeysOf(spec.state?.keys?.local),
        box: stateKeysOf(spec.state?.keys?.box),
      },
      bareActions: { create: spec.bareActions?.create ?? [], call: spec.bareActions?.call ?? [] },
    }
  }

  if (format === 'arc32') {
    const parsed = arc32Schema.safeParse(raw)
    if (!parsed.success)
      throw invalid(`appSpec is not a valid ARC-32 file — ${zodDetail(parsed.error)}`)
    const spec = parsed.data
    return {
      format,
      name: spec.contract.name,
      description: spec.contract.desc,
      methods: methodsViaAbiContract(spec.contract.name, spec.contract.methods),
      schema: {
        globalInts: spec.state?.global?.num_uints ?? 0,
        globalBytes: spec.state?.global?.num_byte_slices ?? 0,
        localInts: spec.state?.local?.num_uints ?? 0,
        localBytes: spec.state?.local?.num_byte_slices ?? 0,
      },
      source: spec.source,
      byteCode: spec.byteCode,
      templateVariables: scanTemplateVariables(spec.source),
    }
  }

  const parsed = arc4ContractSchema.safeParse(raw)
  if (!parsed.success)
    throw invalid(`appSpec is not a valid ARC-4 contract — ${zodDetail(parsed.error)}`)
  return {
    format,
    name: parsed.data.name,
    description: parsed.data.desc,
    methods: methodsViaAbiContract(parsed.data.name, parsed.data.methods),
    schema: { globalInts: 0, globalBytes: 0, localInts: 0, localBytes: 0 },
    templateVariables: [],
  }
}

/** normalizeAppSpec for discovery scans: non-spec input yields undefined, never throws. */
export function tryNormalizeAppSpec(appSpecJson: string): NormalizedAppSpec | undefined {
  try {
    return normalizeAppSpec(appSpecJson)
  } catch {
    return undefined
  }
}

/** Normalizes any accepted format and decodes TEAL/bytecode for deploy. */
export function parseAppSpec(appSpecJson: string): ParsedAppSpec {
  const spec = normalizeAppSpec(appSpecJson)
  return {
    name: spec.name,
    approvalTeal: decodeTeal(spec.source?.approval),
    clearTeal: decodeTeal(spec.source?.clear),
    approvalByteCode: spec.byteCode?.approval ? base64ToBytes(spec.byteCode.approval) : undefined,
    clearByteCode: spec.byteCode?.clear ? base64ToBytes(spec.byteCode.clear) : undefined,
    schema: spec.schema,
    methods: spec.methods,
  }
}

/**
 * Substitute TMPL_<KEY> deploy-time template parameters in TEAL source.
 * Values are inserted as literals (numbers plain; strings as-is).
 */
export function substituteTemplateParams(
  teal: string,
  params: Record<string, string | number> | undefined,
): string {
  if (!params) return teal
  let out = teal
  for (const [key, value] of Object.entries(params)) {
    const token = key.startsWith('TMPL_') ? key : `TMPL_${key}`
    out = out.replaceAll(token, String(value))
  }
  return out
}
