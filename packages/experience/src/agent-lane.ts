/**
 * The agent lane's result-to-view bridge. Tools return structured JSON and
 * declare a view id (tool name, then `display`, are fallbacks for tools
 * that have not declared one). The tool's cue picks the view, never the
 * model; any third-party tool that declares a trusted view and matches the
 * wire schema gets the same card. Unknown cues or unexpected shapes fall
 * back to a raw record with no view — never a dropped result.
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

const VIEW_BY_DISPLAY: Record<string, TrustedViewId> = {
  txn: 'transaction.detail',
}

const VIEW_BY_TOOL: Record<string, TrustedViewId> = {
  lookup_transaction: 'transaction.detail',
  search_transactions: 'transaction.list',
  search_account_transactions: 'transaction.list',
  search_asset_transactions: 'transaction.list',
  lookup_transaction_group: 'transaction.group',
  get_account_portfolio: 'account.portfolio',
  lookup_account: 'account.summary',
  search_accounts: 'account.list',
  batch_lookup_accounts: 'account.list',
  lookup_asset: 'asset.detail',
  get_asset_info: 'asset.detail',
  search_assets: 'asset.list',
  get_account_assets: 'asset.list',
  search_asset_balances: 'asset.holders',
  lookup_application: 'application.detail',
  search_applications: 'application.list',
  get_account_app_local_states: 'application.state',
  read_local_state: 'application.state',
  read_global_state: 'application.state',
  lookup_application_logs: 'application.logs',
  read_box_state: 'application.box',
  lookup_block: 'block.detail',
  search_block_headers: 'block.list',
  get_network: 'network.status',
  get_network_status: 'network.status',
}

function isTrustedViewId(value: string): value is TrustedViewId {
  return (TRUSTED_VIEW_IDS as readonly string[]).includes(value)
}

/** Resolves the trusted view cue: declared view, then tool name, then display. */
export function viewCueForToolResult(event: ToolResultEventLike): TrustedViewId | undefined {
  if (event.view && isTrustedViewId(event.view)) return event.view
  if (VIEW_BY_TOOL[event.toolName]) return VIEW_BY_TOOL[event.toolName]
  if (event.display && VIEW_BY_DISPLAY[event.display]) return VIEW_BY_DISPLAY[event.display]
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
 * view from the tool's declared view id (display hint and first-party names
 * remain fallback cues).
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
