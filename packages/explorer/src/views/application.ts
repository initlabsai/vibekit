import algosdk from 'algosdk'
import { viewDataSchemas, type ViewData } from '@initlabs/vibekit/tools/views'
import { z } from 'zod'

import { uint64JsonSchema } from '../core/algo.js'
import { algorandAddressCandidateSchema } from '../core/classifier.js'
import type { ResultIdentity, StructuredResult } from '../core/results.js'
import { addressEnvelopeSchema, record, viewModelFor } from './derive.js'

const optionalAddress = z.string().min(1).optional()

const stateSchema = z.object({
  numByteSlice: z.number().int().nonnegative(),
  numUint: z.number().int().nonnegative(),
})

/** One decoded global-state entry: key (utf-8 or base64), typed value. */
export const applicationGlobalEntrySchema = z.object({
  key: z.string(),
  type: z.enum(['uint', 'bytes']),
  uint: uint64JsonSchema.optional(),
  bytes: z.string().optional(),
})

/** Authoritative application data required by the trusted application detail view. */
export const applicationDetailDataSchema = z.object({
  applicationId: uint64JsonSchema,
  creator: algorandAddressCandidateSchema.optional(),
  account: algorandAddressCandidateSchema.optional(),
  globalStateCount: z.number().int().nonnegative(),
  globalState: z.array(applicationGlobalEntrySchema).optional(),
  localStateSchema: stateSchema.optional(),
  globalStateSchema: stateSchema.optional(),
})

/** Authoritative application data required by the trusted application detail view. */
export type ApplicationDetailData = z.infer<typeof applicationDetailDataSchema>

/** One application row in a list. */
export const applicationRowSchema = z.object({
  applicationId: uint64JsonSchema,
  creator: optionalAddress,
  globalStateCount: z.number().int().nonnegative().optional(),
})

/** A page of applications. */
export const applicationListDataSchema = z.object({
  applications: z.array(applicationRowSchema),
  nextToken: z.string().min(1).optional(),
})

/** One decoded application state entry. */
export const applicationStateEntrySchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  type: z.enum(['uint', 'bytes']),
})

/**
 * One application's decoded state (read_global_state / read_local_state).
 * address and optedIn appear only for local scope.
 */
export const applicationStateDataSchema = z.object({
  applicationId: uint64JsonSchema,
  scope: z.enum(['global', 'local']),
  address: optionalAddress,
  optedIn: z.boolean().optional(),
  entries: z.array(applicationStateEntrySchema),
})

/** One app's local state within an account's opted-in list. */
export const applicationLocalStateAppSchema = z.object({
  applicationId: uint64JsonSchema,
  schema: stateSchema.optional(),
  entries: z.array(applicationStateEntrySchema),
})

/** Every application one account holds local state for (get_account_app_local_states). */
export const applicationLocalsDataSchema = z.object({
  address: optionalAddress,
  apps: z.array(applicationLocalStateAppSchema),
  nextToken: z.string().min(1).optional(),
})

/** Application log lines grouped by transaction. */
export const applicationLogsDataSchema = z.object({
  applicationId: uint64JsonSchema,
  logData: z.array(
    z.object({
      txid: z.string().min(1),
      logs: z.array(z.string()),
    }),
  ),
  nextToken: z.string().min(1).optional(),
})

/** A page of an application's box names (no values). */
export const applicationBoxesDataSchema = z.object({
  applicationId: uint64JsonSchema,
  boxes: z.array(z.object({ name: z.string(), nameBase64: z.string() })),
  truncated: z.boolean().optional(),
})

/** One application box value. */
export const applicationBoxDataSchema = z.object({
  applicationId: uint64JsonSchema,
  boxName: z.string().min(1),
  exists: z.boolean(),
  value: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
})

/** One page of an application's disassembled program plus its static facts. */
export const applicationProgramDataSchema = viewDataSchemas['application.program']
export type ApplicationProgramData = z.infer<typeof applicationProgramDataSchema>

/** An application's call surface: entrypoints from the program, spec detail when known. */
export const applicationMethodsDataSchema = z.object({
  applicationId: uint64JsonSchema,
  analysis: z.object({ entrypoints: z.array(z.string()) }),
  methods: applicationProgramDataSchema.shape.methods,
})
export type ApplicationMethodsData = z.infer<typeof applicationMethodsDataSchema>

/** The agent's own write-up of a contract, rendered as markdown. Not chain data. */
export const applicationExplanationDataSchema = z.object({
  applicationId: uint64JsonSchema,
  markdown: z.string().min(1),
})
export type ApplicationExplanationData = z.infer<typeof applicationExplanationDataSchema>

export type ApplicationListData = z.infer<typeof applicationListDataSchema>
export type ApplicationStateData = z.infer<typeof applicationStateDataSchema>
export type ApplicationLocalsData = z.infer<typeof applicationLocalsDataSchema>
export type ApplicationLogsData = z.infer<typeof applicationLogsDataSchema>
export type ApplicationBoxData = z.infer<typeof applicationBoxDataSchema>

/** The capability of looking an application up as an authoritative record. */
export interface ApplicationLookupHost {
  lookupApplication(applicationId: number): Promise<StructuredResult>
}

/** base64 key -> utf-8 when all printable, else the base64 itself. */
function decodeStateKey(base64: string): string {
  try {
    const text = new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)))
    return /^[\x20-\x7e]+$/.test(text) ? text : base64
  } catch {
    return base64
  }
}

function decodeGlobalEntry(entry: {
  key: string
  value: { type: number; bytes?: string; uint?: number | string }
}): { key: string; type: 'uint' | 'bytes'; uint?: number | string; bytes?: string } {
  const key = decodeStateKey(entry.key)
  return entry.value.type === 1
    ? { key, type: 'bytes', bytes: entry.value.bytes ?? '' }
    : { key, type: 'uint', uint: entry.value.uint ?? 0 }
}

/** Wraps a lookup_application result: escrow account and state count derive from the wire. */
export function buildApplicationDetailRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_application',
): StructuredResult {
  const { globalState, ...application } = viewDataSchemas['application.detail'].parse(wire)
  const data: ApplicationDetailData = {
    ...application,
    account: String(algosdk.getApplicationAddress(BigInt(application.applicationId))),
    globalStateCount: globalState?.length ?? 0,
    ...(globalState?.length ? { globalState: globalState.map(decodeGlobalEntry) } : {}),
  }
  return record(identity, toolName, data)
}

/** Wraps search_applications. */
export function buildApplicationListRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_applications',
): StructuredResult {
  const page = viewDataSchemas['application.list'].parse(wire)
  const data: ApplicationListData = {
    applications: page.applications.map(({ globalState, ...application }) => ({
      applicationId: application.applicationId,
      creator: application.creator,
      globalStateCount: globalState?.length ?? 0,
    })),
    nextToken: page.nextToken,
  }
  return record(identity, toolName, data)
}

/** Wraps read_global_state and read_local_state (the unified scope shape). */
export function buildApplicationStateRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'read_global_state',
): StructuredResult {
  const single = viewDataSchemas['application.state'].parse(wire)
  const data: ApplicationStateData = {
    applicationId: single.appId,
    scope: single.scope,
    address: single.address,
    optedIn: single.optedIn,
    entries: single.state.map((entry) => ({
      key: entry.key,
      value: String(entry.value),
      type: entry.type,
    })),
  }
  return record(identity, toolName, data)
}

type LocalKeyValue = ViewData<'application.locals'>['appLocalStates'][number]['keyValue'][number]

function localStateEntry(entry: LocalKeyValue) {
  // Algod state types: 1 = bytes, 2 = uint.
  if (entry.value.type === 2 || entry.value.uint !== undefined) {
    return {
      key: entry.key,
      value: String(entry.value.uint ?? 0),
      type: 'uint' as const,
    }
  }
  return {
    key: entry.key,
    value: entry.value.bytes ?? '',
    type: 'bytes' as const,
  }
}

/** Wraps get_account_app_local_states. */
export function buildApplicationLocalsRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'get_account_app_local_states',
): StructuredResult {
  const page = viewDataSchemas['application.locals'].parse(wire)
  const { address } = addressEnvelopeSchema.parse(wire)
  const data: ApplicationLocalsData = {
    address,
    apps: page.appLocalStates.map((app) => ({
      applicationId: app.applicationId,
      schema: app.schema,
      entries: app.keyValue.map(localStateEntry),
    })),
    nextToken: page.nextToken,
  }
  return record(identity, toolName, data)
}

/** Wraps lookup_application_logs. */
export function buildApplicationLogsRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_application_logs',
): StructuredResult {
  return record(identity, toolName, applicationLogsDataSchema.parse(wire))
}

/** Wraps get_application_program. */
export function buildApplicationProgramRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'get_application_program',
): StructuredResult {
  return record(identity, toolName, applicationProgramDataSchema.parse(wire))
}

/** The methods view over a get_application_program record (or any wire with the same keys). */
export function buildApplicationMethodsRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'get_application_program',
): StructuredResult {
  return record(identity, toolName, applicationMethodsDataSchema.parse(wire))
}

/** Wraps explain_application — the model's markdown, kept verbatim. */
export function buildApplicationExplanationRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'explain_application',
): StructuredResult {
  return record(identity, toolName, applicationExplanationDataSchema.parse(wire))
}

/** Wraps read_box_state. */
export function buildApplicationBoxRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'read_box_state',
): StructuredResult {
  const box = viewDataSchemas['application.box'].parse(wire)
  const data: ApplicationBoxData = {
    applicationId: box.appId,
    boxName: box.boxName,
    exists: box.exists,
    value: box.value,
    size: box.size,
  }
  return record(identity, toolName, data)
}

/** Wraps list_application_boxes. */
export function buildApplicationBoxesRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'list_application_boxes',
): StructuredResult {
  const page = viewDataSchemas['application.boxes'].parse(wire)
  const data = {
    applicationId: page.appId,
    boxes: page.boxes,
    truncated: page.truncated,
  }
  return record(identity, toolName, data)
}

/** Derives application presentation from one trusted result reference. */
export const createApplicationDetailViewModel = viewModelFor(
  applicationDetailDataSchema,
  'application.detail' as const,
  'Application detail',
)
export const createApplicationListViewModel = viewModelFor(
  applicationListDataSchema,
  'application.list' as const,
  'Application list',
)
export const createApplicationStateViewModel = viewModelFor(
  applicationStateDataSchema,
  'application.state' as const,
  'Application state',
)
export const createApplicationLocalsViewModel = viewModelFor(
  applicationLocalsDataSchema,
  'application.locals' as const,
  'Application local states',
)
export const createApplicationLogsViewModel = viewModelFor(
  applicationLogsDataSchema,
  'application.logs' as const,
  'Application logs',
)
export const createApplicationProgramViewModel = viewModelFor(
  applicationProgramDataSchema,
  'application.program' as const,
  'Application program',
)
export const createApplicationMethodsViewModel = viewModelFor(
  applicationMethodsDataSchema,
  'application.methods' as const,
  'Application methods',
)
export const createApplicationExplanationViewModel = viewModelFor(
  applicationExplanationDataSchema,
  'application.explanation' as const,
  'Application explanation',
)
export const createApplicationBoxViewModel = viewModelFor(
  applicationBoxDataSchema,
  'application.box' as const,
  'Application box',
)
export const createApplicationBoxesViewModel = viewModelFor(
  applicationBoxesDataSchema,
  'application.boxes' as const,
  'Application boxes',
)

/** Renderer-ready semantic model for the trusted application detail view. */
export type ApplicationDetailViewModel = Extract<
  ReturnType<typeof createApplicationDetailViewModel>,
  { ok: true }
>['model']
export type ApplicationListViewModel = Extract<
  ReturnType<typeof createApplicationListViewModel>,
  { ok: true }
>['model']
export type ApplicationStateViewModel = Extract<
  ReturnType<typeof createApplicationStateViewModel>,
  { ok: true }
>['model']
export type ApplicationLocalsViewModel = Extract<
  ReturnType<typeof createApplicationLocalsViewModel>,
  { ok: true }
>['model']
export type ApplicationProgramViewModel = Extract<
  ReturnType<typeof createApplicationProgramViewModel>,
  { ok: true }
>['model']
export type ApplicationMethodsViewModel = Extract<
  ReturnType<typeof createApplicationMethodsViewModel>,
  { ok: true }
>['model']
export type ApplicationExplanationViewModel = Extract<
  ReturnType<typeof createApplicationExplanationViewModel>,
  { ok: true }
>['model']
export type ApplicationLogsViewModel = Extract<
  ReturnType<typeof createApplicationLogsViewModel>,
  { ok: true }
>['model']
export type ApplicationBoxViewModel = Extract<
  ReturnType<typeof createApplicationBoxViewModel>,
  { ok: true }
>['model']
