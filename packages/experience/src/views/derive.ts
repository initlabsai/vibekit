import { z } from 'zod'

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

export function record(
  identity: ResultIdentity,
  toolName: string,
  data: unknown,
): StructuredResult {
  return structuredResultSchema.parse({
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    type: 'result',
    state: 'success',
    resultId: identity.resultId,
    toolCallId: identity.toolCallId,
    toolName,
    network: identity.network,
    data,
  })
}

/**
 * Hosts scope some list wires to an account by merging an `address` key into
 * the tool result; the tools schemas know nothing about it, so it is parsed
 * beside them.
 */
export const addressEnvelopeSchema = z.object({ address: z.string().min(1).optional() })

export function derive<S extends z.ZodType, View extends string>(
  store: ResultStore,
  view: ViewSpec,
  schema: S,
  viewId: View,
  message: string,
):
  | { ok: true; model: { view: View; network: string } & z.infer<S> }
  | { ok: false; error: ViewModelError } {
  const resolution = resolveResultReference(store, view.source)
  if (!resolution.ok) return resolution
  const parsed = schema.safeParse(resolution.value)
  if (!parsed.success) {
    return { ok: false, error: { code: 'INVALID_VIEW_DATA', message } }
  }
  return {
    ok: true,
    model: {
      view: viewId,
      network: resolution.record.network,
      ...(parsed.data as Record<string, unknown>),
    } as { view: View; network: string } & z.infer<S>,
  }
}

export function viewModelFor<S extends z.ZodType, View extends string>(
  schema: S,
  viewId: View,
  label: string,
) {
  return (store: ResultStore, view: ViewSpec) =>
    derive(store, view, schema, viewId, `${label} did not match the trusted schema`)
}
