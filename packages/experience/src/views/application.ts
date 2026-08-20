import algosdk from 'algosdk'
import { viewDataSchemas, type ViewData } from '@initlabs/vibekit-tools/views'
import { z } from 'zod'

import { uint64JsonSchema } from '../core/algo.js'
import { algorandAddressCandidateSchema } from '../core/classifier.js'
import type { ViewSpec } from '../core/protocol.js'
import {
  resolveResultReference,
  structuredResultSchema,
  type ResultIdentity,
  type ResultStore,
  type StructuredResult,
  type ViewModelError,
} from '../core/results.js'
import { EXPERIENCE_PROTOCOL_VERSION } from '../core/version.js'
import { addressEnvelopeSchema, record, viewModelFor } from './derive.js'

const optionalAddress = z.string().min(1).optional()

const stateSchema = z
  .object({
    numByteSlice: z.number().int().nonnegative(),
    numUint: z.number().int().nonnegative(),
  })
  .strict()

/** Authoritative application data required by the trusted application detail view. */
export const applicationDetailDataSchema = z
  .object({
    applicationId: uint64JsonSchema,
    creator: algorandAddressCandidateSchema.optional(),
    account: algorandAddressCandidateSchema.optional(),
    globalStateCount: z.number().int().nonnegative(),
    localStateSchema: stateSchema.optional(),
    globalStateSchema: stateSchema.optional(),
  })
  .strict()

/** Authoritative application data required by the trusted application detail view. */
export type ApplicationDetailData = z.infer<typeof applicationDetailDataSchema>

/** One application row in a list. */
export const applicationRowSchema = z
  .object({
    applicationId: uint64JsonSchema,
    creator: optionalAddress,
    globalStateCount: z.number().int().nonnegative().optional(),
  })
  .strict()

/** A page of applications. */
export const applicationListDataSchema = z
  .object({
    applications: z.array(applicationRowSchema),
    nextToken: z.string().min(1).optional(),
  })
  .strict()

/** One decoded application state entry. */
export const applicationStateEntrySchema = z
  .object({
    key: z.string().min(1),
    value: z.string(),
    type: z.enum(['uint', 'bytes']),
  })
  .strict()

/**
 * One application's decoded state (read_global_state / read_local_state).
 * address and optedIn appear only for local scope.
 */
export const applicationStateDataSchema = z
  .object({
    applicationId: uint64JsonSchema,
    scope: z.enum(['global', 'local']),
    address: optionalAddress,
    optedIn: z.boolean().optional(),
    entries: z.array(applicationStateEntrySchema),
  })
  .strict()

/** One app's local state within an account's opted-in list. */
export const applicationLocalStateAppSchema = z
  .object({
    applicationId: uint64JsonSchema,
    schema: z
      .object({
        numByteSlice: z.number().int().nonnegative(),
        numUint: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
    entries: z.array(applicationStateEntrySchema),
  })
  .strict()

/** Every application one account holds local state for (get_account_app_local_states). */
export const applicationLocalsDataSchema = z
  .object({
    address: optionalAddress,
    apps: z.array(applicationLocalStateAppSchema),
    nextToken: z.string().min(1).optional(),
  })
  .strict()

/** Application log lines grouped by transaction. */
export const applicationLogsDataSchema = z
  .object({
    applicationId: uint64JsonSchema,
    logData: z.array(
      z
        .object({
          txid: z.string().min(1),
          logs: z.array(z.string()),
        })
        .strict(),
    ),
    nextToken: z.string().min(1).optional(),
  })
  .strict()

/** One application box value. */
export const applicationBoxDataSchema = z
  .object({
    applicationId: uint64JsonSchema,
    boxName: z.string().min(1),
    exists: z.boolean(),
    value: z.string().optional(),
    size: z.number().int().nonnegative().optional(),
  })
  .strict()

export type ApplicationListData = z.infer<typeof applicationListDataSchema>
export type ApplicationStateData = z.infer<typeof applicationStateDataSchema>
export type ApplicationLocalsData = z.infer<typeof applicationLocalsDataSchema>
export type ApplicationLogsData = z.infer<typeof applicationLogsDataSchema>
export type ApplicationBoxData = z.infer<typeof applicationBoxDataSchema>

/** The capability of looking an application up as an authoritative record. */
export interface ApplicationLookupHost {
  lookupApplication(applicationId: number): Promise<StructuredResult>
}

/** Wraps a lookup_application result as an application detail record. */
export function buildApplicationDetailRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_application',
): StructuredResult {
  const application = viewDataSchemas['application.detail'].parse(wire)
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName,
    network: identity.network,
    data: applicationDetailDataSchema.parse({
      applicationId: application.applicationId,
      account: String(algosdk.getApplicationAddress(BigInt(application.applicationId))),
      globalStateCount: application.globalState?.length ?? 0,
      ...(application.creator === undefined ? {} : { creator: application.creator }),
      ...(application.localStateSchema === undefined
        ? {}
        : { localStateSchema: application.localStateSchema }),
      ...(application.globalStateSchema === undefined
        ? {}
        : { globalStateSchema: application.globalStateSchema }),
    }),
  })
}

/** Wraps search_applications. */
export function buildApplicationListRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'search_applications',
): StructuredResult {
  const page = viewDataSchemas['application.list'].parse(wire)
  return record(
    identity,
    toolName,
    applicationListDataSchema.parse({
      applications: page.applications.map((application) => ({
        applicationId: application.applicationId,
        ...(application.creator === undefined ? {} : { creator: application.creator }),
        globalStateCount: application.globalState?.length ?? 0,
      })),
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

/** Wraps read_global_state and read_local_state (the unified scope shape). */
export function buildApplicationStateRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'read_global_state',
): StructuredResult {
  const single = viewDataSchemas['application.state'].parse(wire)
  return record(
    identity,
    toolName,
    applicationStateDataSchema.parse({
      applicationId: single.appId,
      scope: single.scope,
      ...(single.address === undefined ? {} : { address: single.address }),
      ...(single.optedIn === undefined ? {} : { optedIn: single.optedIn }),
      entries: single.state.map((entry) => ({
        key: entry.key,
        value: String(entry.value),
        type: entry.type,
      })),
    }),
  )
}

type LocalKeyValue =
  ViewData<'application.locals'>['appLocalStates'][number]['keyValue'][number]

function localStateEntry(entry: LocalKeyValue) {
  // Algod state types: 1 = bytes, 2 = uint.
  if (entry.value.type === 2 || entry.value.uint !== undefined) {
    return { key: entry.key, value: String(entry.value.uint ?? 0), type: 'uint' as const }
  }
  return { key: entry.key, value: entry.value.bytes ?? '', type: 'bytes' as const }
}

/** Wraps get_account_app_local_states. */
export function buildApplicationLocalsRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'get_account_app_local_states',
): StructuredResult {
  const page = viewDataSchemas['application.locals'].parse(wire)
  const { address } = addressEnvelopeSchema.parse(wire)
  return record(
    identity,
    toolName,
    applicationLocalsDataSchema.parse({
      ...(address === undefined ? {} : { address }),
      apps: page.appLocalStates.map((app) => ({
        applicationId: app.applicationId,
        schema: app.schema,
        entries: app.keyValue.map(localStateEntry),
      })),
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

/** Wraps lookup_application_logs. */
export function buildApplicationLogsRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'lookup_application_logs',
): StructuredResult {
  const page = viewDataSchemas['application.logs'].parse(wire)
  return record(
    identity,
    toolName,
    applicationLogsDataSchema.parse({
      applicationId: page.applicationId,
      logData: page.logData,
      ...(page.nextToken === undefined ? {} : { nextToken: page.nextToken }),
    }),
  )
}

/** Wraps read_box_state. */
export function buildApplicationBoxRecord(
  identity: ResultIdentity,
  wire: unknown,
  toolName = 'read_box_state',
): StructuredResult {
  const box = viewDataSchemas['application.box'].parse(wire)
  return record(
    identity,
    toolName,
    applicationBoxDataSchema.parse({
      applicationId: box.appId,
      boxName: box.boxName,
      exists: box.exists,
      ...(box.value === undefined ? {} : { value: box.value }),
      ...(box.size === undefined ? {} : { size: box.size }),
    }),
  )
}

/** Renderer-ready semantic model for the trusted application detail view. */
export const applicationDetailViewModelSchema = z
  .object({
    view: z.literal('application.detail'),
    network: z.string().min(1),
    applicationId: applicationDetailDataSchema.shape.applicationId,
    creator: z.string().optional(),
    account: z.string().optional(),
    globalStateCount: z.number().int().nonnegative(),
    localStateSchema: applicationDetailDataSchema.shape.localStateSchema,
    globalStateSchema: applicationDetailDataSchema.shape.globalStateSchema,
  })
  .strict()

/** Renderer-ready semantic model for the trusted application detail view. */
export type ApplicationDetailViewModel = z.infer<typeof applicationDetailViewModelSchema>

/** Result of deriving the renderer-ready application detail model. */
export type ApplicationDetailViewModelResult =
  { ok: true; model: ApplicationDetailViewModel } | { ok: false; error: ViewModelError }

/** Derives application presentation from one trusted result reference. */
export function createApplicationDetailViewModel(
  store: ResultStore,
  view: ViewSpec,
): ApplicationDetailViewModelResult {
  const resolution = resolveResultReference(store, view.source)
  if (!resolution.ok) return resolution

  const parsed = applicationDetailDataSchema.safeParse(resolution.value)
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_VIEW_DATA',
        message: 'Application result did not match the trusted application schema',
      },
    }
  }
  return {
    ok: true,
    model: applicationDetailViewModelSchema.parse({
      view: 'application.detail',
      network: resolution.record.network,
      ...parsed.data,
    }),
  }
}

export const createApplicationListViewModel = viewModelFor(applicationListDataSchema, 'application.list' as const, 'Application list')
export const createApplicationStateViewModel = viewModelFor(applicationStateDataSchema, 'application.state' as const, 'Application state')
export const createApplicationLocalsViewModel = viewModelFor(applicationLocalsDataSchema, 'application.locals' as const, 'Application local states')
export const createApplicationLogsViewModel = viewModelFor(applicationLogsDataSchema, 'application.logs' as const, 'Application logs')
export const createApplicationBoxViewModel = viewModelFor(applicationBoxDataSchema, 'application.box' as const, 'Application box')

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
export type ApplicationLogsViewModel = Extract<
  ReturnType<typeof createApplicationLogsViewModel>,
  { ok: true }
>['model']
export type ApplicationBoxViewModel = Extract<
  ReturnType<typeof createApplicationBoxViewModel>,
  { ok: true }
>['model']
