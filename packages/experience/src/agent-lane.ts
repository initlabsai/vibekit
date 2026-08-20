/**
 * The agent lane's result-to-view bridge. Tools return structured JSON and
 * declare a display hint; the renderer maps hint + parseable data onto a
 * trusted view id — the tool's cue picks the view, never the model, and any
 * third-party tool that declares a hint and matches the wire schema gets the
 * same card. Unknown hints (or unexpected shapes) fall back to a raw record
 * with no view — never a dropped result. A finer-grained `view:` declaration
 * on ToolDefinition is planned protocol work.
 */
import { buildAccountPortfolioRecord } from './live-account.js'
import {
  composeWireResultSchema,
  structuredResultFromToolEvent,
  type ResultIdentity,
  type ToolResultEventLike,
} from './live-payment.js'
import { buildTransactionDetailRecord } from './live-transaction.js'
import type { StructuredResult } from './results.js'

/** A structured record plus the trusted view its tool's cue selected, if any. */
export interface BridgedToolResult {
  record: StructuredResult
  view?: 'transaction.detail' | 'account.portfolio'
}

/**
 * Wraps one agent tool result as a structured record, selecting a trusted
 * view from the tool's declared display hint (with the first-party tool
 * names as a fallback cue while tools don't declare view ids yet).
 */
export function bridgeToolResult(
  event: ToolResultEventLike,
  identity: ResultIdentity,
): BridgedToolResult {
  if (!event.isError) {
    const wantsTransaction = event.display === 'txn' || event.toolName === 'lookup_transaction'
    const wantsAccount = event.display === 'account' || event.toolName === 'get_account_portfolio'
    try {
      if (wantsTransaction) {
        return {
          record: buildTransactionDetailRecord(identity, event.output, event.toolName),
          view: 'transaction.detail',
        }
      }
      if (wantsAccount) {
        return {
          record: buildAccountPortfolioRecord(identity, event.output, event.toolName),
          view: 'account.portfolio',
        }
      }
    } catch {
      // Wire didn't match the trusted shape — keep the raw record instead.
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
