/**
 * simulate_transactions tool
 *
 * Simulates transactions without broadcasting to preview execution results.
 * Shows what would happen: success/failure, state changes, costs, and errors.
 *
 * Supports all the same transaction types as send_group_transactions.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { parseArgs, type ToolContext } from '../types.js'
import { resolveSender } from '../../lib/account-service.js'
import { transactionsSchema } from './schema.js'
import {
  simulateTransactions,
  type ExecTraceConfig,
  type SimulateTransactionsResult,
} from './shared.js'
import type { TxnSpec } from './types.js'

export const simulateTransactionsTool: Tool = {
  name: 'simulate_transactions',
  description: `Simulate a transaction or atomic group without broadcasting.
Shows what would happen: success/failure, state changes, costs, and errors.

Use this to preview any transaction before committing. Supports all the same
transaction types as send_group_transactions.

Options:
- allowMoreLogging: Lift log limits for verbose output
- allowUnnamedResources: Allow unnamed resources in app calls (default: true)
- extraOpcodeBudget: Add extra opcode budget for complex contracts
- execTraceConfig: Enable execution tracing for debugging
  - enable: boolean - turn on tracing
  - scratchChange: boolean - track scratch space changes
  - stackChange: boolean - track stack changes
  - stateChange: boolean - track global/local/box state changes

Returns:
- wouldSucceed: Whether the transaction(s) would succeed
- failureMessage: Error details if it would fail
- simulatedRound: The round used for simulation
- txIds: Transaction IDs that would be created
- groupId: Group ID for atomic transactions
- returns: ABI method return values
- transactionResults: Per-transaction details (logs, state deltas, budget)
- trace: Execution trace (if execTraceConfig.enable = true)

Example - simulate a payment:
{"transactions": [{"type": "payment", "receiver": "ADDR...", "amount": 100000}]}

Example - simulate with execution tracing:
{"transactions": [...], "execTraceConfig": {"enable": true, "stateChange": true}}`,
  inputSchema: {
    type: 'object',
    properties: {
      transactions: transactionsSchema,
      allowMoreLogging: {
        type: 'boolean',
        description: 'Lift log limits for verbose output',
        default: false,
      },
      allowUnnamedResources: {
        type: 'boolean',
        description: 'Allow unnamed resources in app calls',
        default: true,
      },
      extraOpcodeBudget: {
        type: 'number',
        description: 'Additional opcode budget for complex contracts',
      },
      execTraceConfig: {
        type: 'object',
        description: 'Execution tracing configuration for debugging',
        properties: {
          enable: {
            type: 'boolean',
            description: 'Enable execution tracing',
          },
          scratchChange: {
            type: 'boolean',
            description: 'Track scratch space changes',
          },
          stackChange: {
            type: 'boolean',
            description: 'Track stack changes',
          },
          stateChange: {
            type: 'boolean',
            description: 'Track global/local/box state changes',
          },
        },
      },
    },
    required: ['transactions'],
  },
}

interface SimulateArgs {
  transactions: TxnSpec[]
  allowMoreLogging?: boolean
  allowUnnamedResources?: boolean
  extraOpcodeBudget?: number
  execTraceConfig?: ExecTraceConfig
}

export async function handleSimulateTransactions(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<SimulateTransactionsResult> {
  const { algorand, config } = ctx
  const {
    transactions,
    allowMoreLogging,
    allowUnnamedResources,
    extraOpcodeBudget,
    execTraceConfig,
  } = parseArgs<SimulateArgs>(args)

  return simulateTransactions(
    { transactions, allowMoreLogging, allowUnnamedResources, extraOpcodeBudget, execTraceConfig },
    algorand,
    config,
    resolveSender
  )
}
