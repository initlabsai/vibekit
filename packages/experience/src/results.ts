import { z } from 'zod'

import { experienceProtocolVersionSchema } from './version.js'

/** A recursively JSON-safe value suitable for browser and terminal consumers. */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/** Zod schema that rejects bigint, bytes, undefined, and non-finite numbers. */
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
)

/** One key or array index in a structured result data path. */
export const resultPathSegmentSchema = z.union([z.string().min(1), z.number().int().nonnegative()])

/** A path from a result's root data value to authoritative nested data. */
export const resultPathSchema = z.array(resultPathSegmentSchema)

const resultReferenceFields = {
  id: z.string().min(1),
  path: resultPathSchema.optional(),
}

/**
 * Opaque reference to a result, addressable by result id or the originating
 * tool-call id, with an optional path into its JSON-safe data.
 */
export const resultReferenceSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('result'), ...resultReferenceFields }).strict(),
  z.object({ source: z.literal('tool-call'), ...resultReferenceFields }).strict(),
])

/** Reference to authoritative structured result data. */
export type ResultReference = z.infer<typeof resultReferenceSchema>

/** Compares two result references by source, id, and full data path. */
export function sameResultReference(left: ResultReference, right: ResultReference): boolean {
  return (
    left.source === right.source &&
    left.id === right.id &&
    JSON.stringify(left.path ?? []) === JSON.stringify(right.path ?? [])
  )
}

const structuredResultBase = {
  protocolVersion: experienceProtocolVersionSchema,
  type: z.literal('result'),
  resultId: z.string().min(1),
  toolCallId: z.string().min(1),
  toolName: z.string().min(1),
  network: z.string().min(1),
}

/** A successfully completed, JSON-safe tool result. */
export const successfulResultSchema = z
  .object({
    ...structuredResultBase,
    state: z.literal('success'),
    data: jsonValueSchema,
  })
  .strict()

/** A failed tool result retained for correlation and explicit rendering. */
export const failedResultSchema = z
  .object({
    ...structuredResultBase,
    state: z.literal('error'),
    error: z.object({ code: z.string().min(1), message: z.string().min(1) }).strict(),
  })
  .strict()

/** A versioned result record stored by Explorer clients. */
export const structuredResultSchema = z.discriminatedUnion('state', [
  successfulResultSchema,
  failedResultSchema,
])

/** A successfully completed, JSON-safe tool result. */
export type SuccessfulResult = z.infer<typeof successfulResultSchema>

/** A failed tool result retained for correlation and explicit rendering. */
export type FailedResult = z.infer<typeof failedResultSchema>

/** A versioned result record stored by Explorer clients. */
export type StructuredResult = z.infer<typeof structuredResultSchema>

/**
 * An immutable client-owned result collection. It is deliberately a value,
 * rather than a singleton store or server-owned notion of "current" results.
 */
export type ResultStore = readonly StructuredResult[]

/** Failure returned when an authoritative result reference cannot resolve. */
export interface ResultResolutionError {
  code: 'RESULT_NOT_FOUND' | 'RESULT_FAILED' | 'PATH_NOT_FOUND'
  message: string
}

/** Result of resolving an authoritative value from a client-owned store. */
export type ResultResolution =
  | { ok: true; record: SuccessfulResult; value: JsonValue }
  | { ok: false; error: ResultResolutionError }

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

/** Creates a validated immutable result store, rejecting ambiguous identifiers. */
export function createResultStore(records: readonly unknown[] = []): ResultStore {
  const resultIds = new Set<string>()
  const toolCallIds = new Set<string>()
  const parsed = records.map((record) => {
    const result = structuredResultSchema.parse(record)
    if (resultIds.has(result.resultId)) {
      throw new Error(`Duplicate result id: ${result.resultId}`)
    }
    if (toolCallIds.has(result.toolCallId)) {
      throw new Error(`Duplicate tool-call id: ${result.toolCallId}`)
    }
    resultIds.add(result.resultId)
    toolCallIds.add(result.toolCallId)
    return deepFreeze(result)
  })
  return Object.freeze(parsed)
}

/** Adds one validated record without mutating the prior store value. */
export function addResult(store: ResultStore, record: unknown): ResultStore {
  return createResultStore([...store, record])
}

/** Finds the record named by a result or tool-call reference. */
export function findResultRecord(
  store: ResultStore,
  reference: ResultReference,
): StructuredResult | undefined {
  return store.find((record) =>
    reference.source === 'result'
      ? record.resultId === reference.id
      : record.toolCallId === reference.id,
  )
}

/** Resolves a reference and optional data path without mutating the store. */
export function resolveResultReference(
  store: ResultStore,
  rawReference: ResultReference,
): ResultResolution {
  const reference = resultReferenceSchema.parse(rawReference)
  const record = findResultRecord(store, reference)
  if (!record) {
    return {
      ok: false,
      error: {
        code: 'RESULT_NOT_FOUND',
        message: `No result found for ${reference.source} id ${reference.id}`,
      },
    }
  }
  if (record.state === 'error') {
    return {
      ok: false,
      error: {
        code: 'RESULT_FAILED',
        message: `Result ${record.resultId} failed: ${record.error.message}`,
      },
    }
  }

  let value: JsonValue = record.data
  for (const segment of reference.path ?? []) {
    if (typeof segment === 'number' && Array.isArray(value) && segment < value.length) {
      value = value[segment]!
      continue
    }
    if (
      typeof segment === 'string' &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.prototype.hasOwnProperty.call(value, segment)
    ) {
      value = value[segment]!
      continue
    }
    return {
      ok: false,
      error: {
        code: 'PATH_NOT_FOUND',
        message: `Path ${(reference.path ?? []).join('.')} does not exist in result ${record.resultId}`,
      },
    }
  }

  return { ok: true, record, value }
}
