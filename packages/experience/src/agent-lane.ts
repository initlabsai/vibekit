/**
 * The agent lane's result-to-view bridge. Tools return structured JSON and
 * declare a view cue; the cue picks the view, never the model. Any
 * third-party tool that declares a trusted view and matches the wire schema
 * gets the same card. Unknown cues or unexpected shapes fall back to a raw
 * record with no view — never a dropped result.
 */
import { buildAccountPortfolioRecord } from './live-account.js'
import { buildApplicationDetailRecord } from './live-application.js'
import { buildAssetDetailRecord } from './live-asset.js'
import { buildBlockDetailRecord } from './live-block.js'
import {
  buildAccountListRecord,
  buildAccountSummaryRecord,
  buildApplicationBoxRecord,
  buildApplicationListRecord,
  buildApplicationLogsRecord,
  buildApplicationStateRecord,
  buildAssetHoldersRecord,
  buildAssetListRecord,
  buildBlockListRecord,
  buildTransactionGroupRecord,
  buildTransactionListRecord,
} from './live-catalog.js'
import { buildNetworkStatusRecord } from './live-network.js'
import {
  composeWireResultSchema,
  structuredResultFromToolEvent,
  type ResultIdentity,
  type ToolResultEventLike,
} from './live-payment.js'
import { buildTransactionDetailRecord } from './live-transaction.js'
import { TRUSTED_VIEW_IDS, type TrustedViewId } from './protocol.js'
import type { StructuredResult } from './results.js'

/** A structured record plus the trusted view its tool's cue selected, if any. */
export interface BridgedToolResult {
  record: StructuredResult
  view?: TrustedViewId
}

function isTrustedViewId(value: string): value is TrustedViewId {
  return (TRUSTED_VIEW_IDS as readonly string[]).includes(value)
}

/** Resolves the trusted view cue from the tool's declared view, if trusted. */
export function viewCueForToolResult(event: ToolResultEventLike): TrustedViewId | undefined {
  if (event.view && isTrustedViewId(event.view)) return event.view
  return undefined
}

function recordForView(
  view: TrustedViewId,
  identity: ResultIdentity,
  output: unknown,
  toolName: string,
): StructuredResult {
  switch (view) {
    case 'transaction.detail':
      return buildTransactionDetailRecord(identity, output, toolName)
    case 'transaction.list':
      return buildTransactionListRecord(identity, output, toolName)
    case 'transaction.group':
      return buildTransactionGroupRecord(identity, output, toolName)
    case 'account.portfolio':
      return buildAccountPortfolioRecord(identity, output, toolName)
    case 'account.summary':
      return buildAccountSummaryRecord(identity, output, toolName)
    case 'account.list':
      return buildAccountListRecord(identity, output, toolName)
    case 'asset.detail':
      return buildAssetDetailRecord(identity, output, toolName)
    case 'asset.list':
      return buildAssetListRecord(identity, output, toolName)
    case 'asset.holders':
      return buildAssetHoldersRecord(identity, output, toolName)
    case 'application.detail':
      return buildApplicationDetailRecord(identity, output, toolName)
    case 'application.list':
      return buildApplicationListRecord(identity, output, toolName)
    case 'application.state':
      return buildApplicationStateRecord(identity, output, toolName)
    case 'application.logs':
      return buildApplicationLogsRecord(identity, output, toolName)
    case 'application.box':
      return buildApplicationBoxRecord(identity, output, toolName)
    case 'block.detail':
      return buildBlockDetailRecord(identity, output, toolName)
    case 'block.list':
      return buildBlockListRecord(identity, output, toolName)
    case 'network.status':
      return buildNetworkStatusRecord(identity, output, toolName)
  }
}

/**
 * Wraps one agent tool result as a structured record, selecting a trusted
 * view from the tool's declared view cue.
 */
export function bridgeToolResult(
  event: ToolResultEventLike,
  identity: ResultIdentity,
): BridgedToolResult {
  if (!event.isError) {
    const view = viewCueForToolResult(event)
    if (view) {
      try {
        return { record: recordForView(view, identity, event.output, event.toolName), view }
      } catch {
        // Wire didn't match the trusted shape — keep the raw record instead.
      }
    }
  }
  return {
    record: structuredResultFromToolEvent(event, {
      resultId: identity.resultId,
      network: identity.network,
    }),
  }
}

/** Back-compatible record-only wrapper over bridgeToolResult. */
export function recordForToolResult(
  event: ToolResultEventLike,
  identity: ResultIdentity,
): StructuredResult {
  return bridgeToolResult(event, identity).record
}

/**
 * Detects an agent-composed payment: a compose-mode send_payment result whose
 * unsigned group the renderer must route into the approval flow instead of
 * leaving it as chat output.
 */
export function paymentComposeFromToolResult(
  event: ToolResultEventLike,
): { unsignedGroup: string[]; summary: string } | undefined {
  if (event.isError || event.toolName !== 'send_payment') return undefined
  const parsed = composeWireResultSchema.safeParse(event.output)
  return parsed.success ? parsed.data : undefined
}
