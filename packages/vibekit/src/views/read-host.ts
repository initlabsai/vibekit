/**
 * Reads as records, over any way of calling a tool. `recordForToolCall`
 * turns a tool's output into the record its view id selects (or a raw
 * record); `createReadHost` is the lookup surface the apps render from,
 * expressed as named tool calls. The live host passes `executeToolCall`;
 * a browser passes a fetch to its server's query route. One mapping.
 */
import type { ResultIdentity, StructuredResult } from '../actions/index.js'
import { bridgeToolResult } from './bridge.js'
import type { ReadHost } from './host.js'

/** A tool's output as the record its view selects; a wire that fails the view's schema stays a raw record. */
export function recordForToolCall(
  identity: ResultIdentity,
  toolName: string,
  output: unknown,
  view?: string,
  isError = false,
): StructuredResult {
  return bridgeToolResult({ id: identity.toolCallId, toolName, output, isError, ...(view ? { view } : {}) }, identity).record
}

/** The read surface over a record-returning `callTool`. */
export function createReadHost(
  callTool: (toolName: string, args: Record<string, unknown>) => Promise<StructuredResult>,
): ReadHost {
  return {
    lookupAccount: (address) => callTool('get_account_portfolio', { address }),
    lookupAccounts: (addresses) => callTool('batch_lookup_accounts', { addresses: [...addresses] }),
    lookupTransaction: (txid) => callTool('lookup_transaction', { txid }),
    lookupTransactionGroup: (groupId) => callTool('lookup_transaction_group', { groupId }),
    lookupAsset: (assetId) => callTool('lookup_asset', { assetId }),
    lookupApplication: (applicationId) => callTool('lookup_application', { applicationId }),
    lookupBlock: (round) => callTool('lookup_block', { round }),
    lookupAccountAssets: (address) => callTool('get_account_assets', { address }),
    lookupAccountAppStates: (address) => callTool('get_account_app_local_states', { address }),
    searchTransactions({ address, assetId, applicationId, round, txType, nextToken }) {
      const page = { limit: 20, ...(nextToken ? { nextToken } : {}), ...(txType ? { txType } : {}) }
      return address
        ? callTool('search_account_transactions', { ...page, address, ...(assetId === undefined ? {} : { assetId }) })
        : callTool('search_transactions', {
            ...page,
            ...(assetId === undefined ? {} : { assetId }),
            ...(applicationId === undefined ? {} : { applicationId }),
            ...(round === undefined ? {} : { minRound: round, maxRound: round }),
          })
    },
    callTool,
  }
}
