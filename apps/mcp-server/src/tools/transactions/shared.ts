/**
 * Thin wrapper that re-exports transaction engine from @vibekit/transactions
 * and provides an MCP-specific adapter for the resolveSender signature.
 */

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { McpConfig } from '../../config.js'
import { readFile } from 'node:fs/promises'
import {
  sendTransactions as _sendTransactions,
  simulateTransactions as _simulateTransactions,
  type SendTransactionsArgs,
  type SendTransactionsResult as _SendTransactionsResult,
  type SimulateTransactionsArgs,
  type SimulateTransactionsResult as _SimulateTransactionsResult,
  type ResolveAppSpecFn,
} from '@vibekit/transactions'

const resolveAppSpecFromFs: ResolveAppSpecFn = async (appSpec, appSpecPath) => {
  if (appSpecPath) return readFile(appSpecPath, 'utf-8')
  return appSpec
}

// Re-export types and build functions directly
export {
  buildTransactionGroup,
  buildTransactionArg,
  processMethodArgs,
  isTransactionArg,
} from '@vibekit/transactions'

export type { SendTransactionsArgs, SimulateTransactionsArgs, ExecTraceConfig } from '@vibekit/transactions'

/** MCP-specific result that includes network */
export interface SendTransactionsResult extends _SendTransactionsResult {
  network: string
}

/** MCP-specific result that includes network */
export interface SimulateTransactionsResult extends _SimulateTransactionsResult {
  network: string
}

/** MCP-specific resolveSender signature (includes config) */
type McpResolveSenderFn = (
  algorand: AlgorandClient,
  config: McpConfig,
  sender?: string
) => Promise<{ address: string }>

/**
 * MCP adapter for sendTransactions — binds config into resolveSenderFn and adds network to result.
 */
export async function sendTransactions(
  args: SendTransactionsArgs,
  algorand: AlgorandClient,
  config: McpConfig,
  resolveSenderFn: McpResolveSenderFn
): Promise<SendTransactionsResult> {
  const result = await _sendTransactions(args, algorand, (alg, sender) =>
    resolveSenderFn(alg, config, sender),
    resolveAppSpecFromFs
  )
  return { ...result, network: config.network }
}

/**
 * MCP adapter for simulateTransactions — binds config into resolveSenderFn and adds network to result.
 */
export async function simulateTransactions(
  args: SimulateTransactionsArgs,
  algorand: AlgorandClient,
  config: McpConfig,
  resolveSenderFn: McpResolveSenderFn
): Promise<SimulateTransactionsResult> {
  const result = await _simulateTransactions(args, algorand, (alg, sender) =>
    resolveSenderFn(alg, config, sender),
    resolveAppSpecFromFs
  )
  return { ...result, network: config.network }
}
