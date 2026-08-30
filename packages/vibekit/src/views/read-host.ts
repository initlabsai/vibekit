/**
 * Reads as records, over any way of calling a tool. `recordForToolCall`
 * turns a tool's output into the record its view id selects (or a raw
 * record); `createReadHost` is the lookup surface the apps render from,
 * expressed as named tool calls. The live host passes `executeToolCall`;
 * a browser passes a fetch to its server's query route. One mapping.
 */
import { executeToolCall, type ResolvedDeployment } from '../core/index.js'
import type { JsonValue, ResultIdentity, StructuredResult } from '../actions/index.js'
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

/**
 * Reads over a deployment: every call runs through `executeToolCall` and
 * comes back as its view's record, with `input` kept so a list can page
 * itself. Hosts scope account lists by merging the address in; the tool's
 * own wire lacks it.
 */
export function createDeploymentReadHost(deployment: ResolvedDeployment, network = deployment.defaultNetwork): ReadHost {
  const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
  return createReadHost(async (toolName, args) => {
    const tool = deployment.tools.find((candidate) => candidate.name === toolName)
    if (!tool) throw new Error(`This host has no tool named ${toolName}`)
    const id = newId('tool-call')
    const output = await executeToolCall(deployment, tool, args)
    const wire =
      typeof args.address === 'string' && output !== null && typeof output === 'object' && !Array.isArray(output)
        ? { ...(output as object), address: args.address }
        : output
    return recordForToolCall({ resultId: newId('result'), toolCallId: id, network, input: args as JsonValue }, toolName, wire, tool.view)
  })
}
