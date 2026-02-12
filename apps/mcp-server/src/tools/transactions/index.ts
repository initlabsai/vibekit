/**
 * Transaction Tools
 *
 * Tools for composing, simulating, and sending atomic transaction groups.
 */

import type { ToolRegistration } from '../types.js'

import {
  sendGroupTransactionsTool,
  handleSendGroupTransactions,
} from './send-group-transactions.js'
import { simulateTransactionsTool, handleSimulateTransactions } from './simulate-transactions.js'

export const transactionTools: ToolRegistration[] = [
  { definition: sendGroupTransactionsTool, handler: handleSendGroupTransactions },
  { definition: simulateTransactionsTool, handler: handleSimulateTransactions },
]

// Re-export shared functions and types for use by wrapper tools
export { sendTransactions, simulateTransactions } from './shared.js'
export type {
  SendTransactionsResult,
  SendTransactionsArgs,
  SimulateTransactionsResult,
  SimulateTransactionsArgs,
} from './shared.js'
