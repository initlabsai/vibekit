/**
 * The agent lane's result-to-view bridge. Tools return structured JSON and
 * declare a view id; that id picks the view, never the model. Any
 * third-party tool that declares a trusted view and matches the wire schema
 * gets the same card. Unknown cues or unexpected shapes fall back to a raw
 * record with no view — never a dropped result.
 */
import { z } from 'zod'

import { TRUSTED_VIEW_IDS, type TrustedViewId } from '../actions/index.js'
import { structuredResultSchema, type JsonValue } from '../actions/index.js'
import { RECORD_PROTOCOL_VERSION } from '../actions/index.js'
import { record } from './derive.js'
import type { ResultIdentity, StructuredResult } from '../actions/index.js'
import { composeWireResultSchema } from '../actions/index.js'
import {
  buildAccountListRecord,
  buildAccountPortfolioRecord,
  buildAccountSummaryRecord,
} from './account.js'
import {
  buildApplicationBoxRecord,
  buildApplicationBoxesRecord,
  buildApplicationProgramRecord,
  buildApplicationMethodsRecord,
  buildApplicationExplanationRecord,
  buildApplicationDetailRecord,
  buildApplicationListRecord,
  buildApplicationLocalsRecord,
  buildApplicationLogsRecord,
  buildApplicationStateRecord,
} from './application.js'
import {
  buildAssetDetailRecord,
  buildAssetHoldersRecord,
  buildAssetHoldingsRecord,
  buildAssetListRecord,
} from './asset.js'
import { buildBlockDetailRecord, buildBlockListRecord } from './block.js'
import { buildNetworkStatusRecord } from './network.js'
import { pluginRecordBuilder } from './plugins.js'
import {
  buildTransactionDetailRecord,
  buildTransactionGroupRecord,
  buildTransactionListRecord,
} from './transaction.js'

/** The tool-result subset of the orchestrator's AgentEvent stream. */
export interface ToolResultEventLike {
  id: string
  toolName: string
  output: unknown
  isError: boolean
  /** The tool's declared view id, when present. */
  view?: string
}

const toolErrorOutputSchema = z.object({
  error: z.object({ code: z.string().min(1), message: z.string().min(1) }),
})

/**
 * Wraps one orchestrator tool-result event as a versioned structured result.
 * The event's `id` is the tool-call id; the caller supplies the result id and
 * the network the call ran on (a call parameter, not event state).
 */
export function structuredResultFromToolEvent(
  event: ToolResultEventLike,
  identity: { resultId: string; network: string; input?: JsonValue },
): StructuredResult {
  if (event.isError) {
    const parsed = toolErrorOutputSchema.safeParse(event.output)
    return structuredResultSchema.parse({
      protocolVersion: RECORD_PROTOCOL_VERSION,
      type: 'result',
      state: 'error',
      resultId: identity.resultId,
      toolCallId: event.id,
      toolName: event.toolName,
      network: identity.network,
      error: parsed.success
        ? parsed.data.error
        : { code: 'TOOL_ERROR', message: 'Tool call failed without a structured error' },
    })
  }
  return record(
    {
      resultId: identity.resultId,
      toolCallId: event.id,
      network: identity.network,
      ...(identity.input === undefined ? {} : { input: identity.input }),
    },
    event.toolName,
    event.output,
  )
}

/** A structured record plus the trusted view its tool's view id selected, if any. */
export interface BridgedToolResult {
  record: StructuredResult
  view?: TrustedViewId
  /** Set when the tool declared a trusted view but its wire didn't parse, so the raw record stands in. */
  degraded?: { view: TrustedViewId; reason: string }
}

/** The first schema issue as `path: message`, else the error text. */
function parseFailure(error: unknown): string {
  const issue = (error as { issues?: Array<{ path: PropertyKey[]; message: string }> } | null)
    ?.issues?.[0]
  if (issue) return `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`
  return error instanceof Error ? error.message : String(error)
}

function isTrustedViewId(value: string): value is TrustedViewId {
  return (TRUSTED_VIEW_IDS as readonly string[]).includes(value)
}

/** The tool's declared view id, when it is a trusted one. */
export function viewCueForToolResult(event: ToolResultEventLike): TrustedViewId | undefined {
  if (event.view && isTrustedViewId(event.view)) return event.view
  return undefined
}

type RecordBuilder = (
  identity: ResultIdentity,
  output: unknown,
  toolName: string,
) => StructuredResult

const RECORD_BUILDERS: Record<TrustedViewId, RecordBuilder> = {
  'transaction.detail': buildTransactionDetailRecord,
  'transaction.list': buildTransactionListRecord,
  'transaction.group': buildTransactionGroupRecord,
  'account.portfolio': buildAccountPortfolioRecord,
  'account.summary': buildAccountSummaryRecord,
  'account.list': buildAccountListRecord,
  'asset.detail': buildAssetDetailRecord,
  'asset.list': buildAssetListRecord,
  'asset.holdings': buildAssetHoldingsRecord,
  'asset.holders': buildAssetHoldersRecord,
  'application.detail': buildApplicationDetailRecord,
  'application.list': buildApplicationListRecord,
  'application.state': buildApplicationStateRecord,
  'application.locals': buildApplicationLocalsRecord,
  'application.logs': buildApplicationLogsRecord,
  'application.box': buildApplicationBoxRecord,
  'application.boxes': buildApplicationBoxesRecord,
  'application.program': buildApplicationProgramRecord,
  'application.methods': buildApplicationMethodsRecord,
  'application.explanation': buildApplicationExplanationRecord,
  'block.detail': buildBlockDetailRecord,
  'block.list': buildBlockListRecord,
  'network.status': buildNetworkStatusRecord,
  'nfd.profile': pluginRecordBuilder('nfd.profile'),
  'nfd.list': pluginRecordBuilder('nfd.list'),
  'vestige.prices': pluginRecordBuilder('vestige.prices'),
  'vestige.markets': pluginRecordBuilder('vestige.markets'),
  'vestige.history': pluginRecordBuilder('vestige.history'),
  'vestige.protocols': pluginRecordBuilder('vestige.protocols'),
  'pera.asset': pluginRecordBuilder('pera.asset'),
  'haystack.quote': pluginRecordBuilder('haystack.quote'),
  'arcade.markets': pluginRecordBuilder('arcade.markets'),
  'arcade.market': pluginRecordBuilder('arcade.market'),
  'arcade.orderbook': pluginRecordBuilder('arcade.orderbook'),
  'arcade.positions': pluginRecordBuilder('arcade.positions'),
  'arcade.orders': pluginRecordBuilder('arcade.orders'),
  'web.results': pluginRecordBuilder('web.results'),
  'web.page': pluginRecordBuilder('web.page'),
}

/**
 * Wraps one agent tool result as a structured record, selecting a trusted
 * view from the tool's declared view id.
 */
export function bridgeToolResult(
  event: ToolResultEventLike,
  identity: ResultIdentity,
): BridgedToolResult {
  let degraded: BridgedToolResult['degraded']
  if (!event.isError) {
    const view = viewCueForToolResult(event)
    if (view) {
      try {
        return { record: RECORD_BUILDERS[view](identity, event.output, event.toolName), view }
      } catch (error: unknown) {
        // Wire didn't match the trusted shape — keep the raw record, and say why.
        degraded = { view, reason: parseFailure(error) }
      }
    }
  }
  return {
    record: structuredResultFromToolEvent(event, {
      resultId: identity.resultId,
      network: identity.network,
      ...(identity.input === undefined ? {} : { input: identity.input }),
    }),
    ...(degraded ? { degraded } : {}),
  }
}

/**
 * Detects an agent-composed write: any successful tool output that is core's
 * UnsignedGroupResult. The app routes it into the approval flow instead
 * of leaving it as chat output. Tool name is not consulted — compose-mode
 * app_call, asset_create, send_payment, and generated ARC-56 writes share
 * this wire.
 */
export function unsignedGroupFromToolResult(
  event: ToolResultEventLike,
): { unsignedGroup: string[]; summary: string } | undefined {
  if (event.isError) return undefined
  const parsed = composeWireResultSchema.safeParse(event.output)
  return parsed.success ? parsed.data : undefined
}
