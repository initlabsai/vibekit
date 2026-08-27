/**
 * The agent lane's result-to-view bridge. Tools return structured JSON and
 * declare a view cue; the cue picks the view, never the model. Any
 * third-party tool that declares a trusted view and matches the wire schema
 * gets the same card. Unknown cues or unexpected shapes fall back to a raw
 * record with no view — never a dropped result.
 */
import { TRUSTED_VIEW_IDS, type TrustedViewId } from './core/protocol.js'
import type { ResultIdentity, StructuredResult } from './core/results.js'
import {
  composeWireResultSchema,
  structuredResultFromToolEvent,
  type ToolResultEventLike,
} from './flows/payment-live.js'
import {
  buildAccountListRecord,
  buildAccountPortfolioRecord,
  buildAccountSummaryRecord,
} from './views/account.js'
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
} from './views/application.js'
import {
  buildAssetDetailRecord,
  buildAssetHoldersRecord,
  buildAssetHoldingsRecord,
  buildAssetListRecord,
} from './views/asset.js'
import { buildBlockDetailRecord, buildBlockListRecord } from './views/block.js'
import { buildNetworkStatusRecord } from './views/network.js'
import {
  buildTransactionDetailRecord,
  buildTransactionGroupRecord,
  buildTransactionListRecord,
} from './views/transaction.js'

/** A structured record plus the trusted view its tool's cue selected, if any. */
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

/** Resolves the trusted view cue from the tool's declared view, if trusted. */
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
}

/**
 * Wraps one agent tool result as a structured record, selecting a trusted
 * view from the tool's declared view cue.
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
 * UnsignedGroupResult. The renderer routes it into the approval flow instead
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
