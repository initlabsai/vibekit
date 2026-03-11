import { z } from 'zod'
import type { ToolDefinition } from '@vibekit/core'
import { sendTransactions } from './compose/send'
import { simulateTransactions } from './compose/simulate'

const transactionSchema = z.object({
  type: z.enum([
    'payment',
    'asset_transfer',
    'asset_opt_in',
    'asset_opt_out',
    'asset_create',
    'asset_config',
    'asset_freeze',
    'asset_destroy',
    'app_call',
    'app_opt_in',
    'app_close_out',
    'app_delete',
  ]).describe('Transaction type'),
  sender: z.string().optional().describe('Sender address. If omitted, uses the active account.'),
  // Payment fields
  receiver: z.string().optional().describe('(payment, asset_transfer) Receiver address'),
  amount: z.number().optional().describe('(payment) Amount in microAlgos. (asset_transfer, asset_create) Amount in base units.'),
  closeRemainderTo: z.string().optional().describe('(payment) Address to receive remaining balance. Closes the account.'),
  // Asset fields
  assetId: z.number().optional().describe('(asset_*) The asset ID'),
  total: z.number().optional().describe('(asset_create) Total supply of the asset'),
  decimals: z.number().optional().describe('(asset_create) Number of decimals (0-19)'),
  assetName: z.string().optional().describe('(asset_create) Asset name'),
  unitName: z.string().optional().describe('(asset_create) Unit name'),
  url: z.string().optional().describe('(asset_create) Asset URL'),
  metadataHash: z.string().optional().describe('(asset_create) 32-byte metadata hash (64 hex chars or 44 base64 chars)'),
  defaultFrozen: z.boolean().optional().describe('(asset_create) Whether holdings are frozen by default'),
  manager: z.string().optional().describe('(asset_create, asset_config) Manager address'),
  reserve: z.string().optional().describe('(asset_create, asset_config) Reserve address'),
  freeze: z.string().optional().describe('(asset_create, asset_config) Freeze address'),
  clawback: z.string().optional().describe('(asset_create, asset_config) Clawback address'),
  freezeTarget: z.string().optional().describe('(asset_freeze) Account to freeze/unfreeze'),
  frozen: z.boolean().optional().describe('(asset_freeze) Whether to freeze (true) or unfreeze (false)'),
  clawbackTarget: z.string().optional().describe('(asset_transfer) For clawback: the account to claw back from'),
  closeAssetTo: z.string().optional().describe('(asset_opt_out, asset_transfer) Account to send remaining balance to'),
  ensureZeroBalance: z.boolean().optional().describe('(asset_opt_out) Fail if account has non-zero balance. Default: true'),
  // App call fields
  appId: z.number().optional().describe('(app_*) The application ID'),
  methodSignature: z.string().optional().describe('(app_call) ARC-4 method signature (e.g., "hello(string)string")'),
  appSpec: z.string().optional().describe('(app_call) Full ARC-56/32 app spec JSON as string'),
  appSpecPath: z.string().optional().describe('(app_call) Path to ARC-56/32 app spec JSON file'),
  method: z.string().optional().describe('(app_call) Method name when using appSpec/appSpecPath'),
  args: z.array(z.any()).optional().describe('(app_call) Method arguments'),
  extraFee: z.number().optional().describe('(app_call) Extra fee in microALGO to cover inner transactions'),
  maxFee: z.number().optional().describe('(app_call) Max fee in microALGO'),
  // Common fields
  note: z.string().optional().describe('Optional transaction note (max 1000 bytes)'),
})

export const transactionWriteTools: ToolDefinition[] = [
  {
    name: 'send_group_transactions',
    description: `Send 1-16 transactions as an atomic group. All transactions succeed or all fail together.

Transaction types and their fields:
- payment: receiver, amount (optional: closeRemainderTo)
- asset_transfer: assetId, receiver, amount (optional: clawbackTarget, closeAssetTo)
- asset_opt_in: assetId
- asset_opt_out: assetId, closeAssetTo (optional: ensureZeroBalance)
- asset_create: total (optional: decimals, assetName, unitName, url, metadataHash, defaultFrozen, manager, reserve, freeze, clawback)
- asset_config: assetId (optional: manager, reserve, freeze, clawback)
- asset_freeze: assetId, freezeTarget, frozen
- asset_destroy: assetId
- app_call: appId + (methodSignature OR appSpec/appSpecPath + method) (optional: args, extraFee)
- app_opt_in: appId (optional: methodSignature or appSpec + method, args, extraFee)
- app_close_out: appId (optional: methodSignature or appSpec + method, args, extraFee)
- app_delete: appId (optional: methodSignature or appSpec + method, args, extraFee)

For methods with transaction args (pay, axfer, etc.), pass transaction objects in the args array:
- pay: {"type": "pay", "receiver": "...", "amount": 100000}
- axfer: {"type": "axfer", "assetId": 123, "receiver": "...", "amount": 1}
- acfg: {"type": "acfg", "assetId": 123, "manager": "..."} (or omit assetId for create)
- afrz: {"type": "afrz", "assetId": 123, "freezeTarget": "...", "frozen": true}

Example: optInToAsset(pay,uint64)void
args: [{"type": "pay", "receiver": "APPADDR", "amount": 100000}, 1659]

Inner transaction fees: If a contract sends inner transactions with fee=0 (fee pooling):
- If you know how many inner txns: use extraFee (e.g., 1000 per inner txn, so 2 inners = extraFee: 2000)
- If unsure: use coverAppCallInnerTransactionFees: true to auto-calculate (requires maxFee on each app_call as safety limit)

All transactions accept optional: sender (defaults to active account), note

Examples:

1. Simple atomic group (payment + asset transfer):
{"transactions": [
  {"type": "payment", "receiver": "ADDR...", "amount": 100000},
  {"type": "asset_transfer", "assetId": 123, "receiver": "ADDR...", "amount": 1}
]}

2. ABI method call with transaction argument:
{"transactions": [
  {"type": "app_call", "appId": 456, "methodSignature": "deposit(pay,uint64)void",
   "args": [{"type": "pay", "receiver": "APPADDR...", "amount": 100000}, 42]}
]}

3. Covering inner transaction fees:
{"transactions": [
  {"type": "app_call", "appId": 456, "methodSignature": "withdraw()void", "maxFee": 5000}
], "coverAppCallInnerTransactionFees": true}`,
    parameters: z.object({
      transactions: z.array(transactionSchema).min(1).max(16).describe('Array of transactions to execute atomically (max 16)'),
      populateAppCallResources: z.boolean().optional().describe('Auto-populate app call resources (accounts, apps, assets, boxes) via simulation. Defaults to true.'),
      coverAppCallInnerTransactionFees: z.boolean().optional().describe('Auto-calculate and cover fees for inner transactions via simulation. Defaults to false.'),
    }),
    handler: async ({ algorand, args, resolveSender, resolveAppSpec }) => {
      const { transactions, populateAppCallResources, coverAppCallInnerTransactionFees } = args
      const result = await sendTransactions(
        { transactions, populateAppCallResources, coverAppCallInnerTransactionFees },
        algorand,
        resolveSender,
        resolveAppSpec
      )
      return {
        success: true,
        groupId: result.groupId,
        txIds: result.txIds,
        confirmedRound: result.confirmedRound,
        returns: result.returns,
        transactionCount: transactions.length,
      }
    },
  },
  {
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
    parameters: z.object({
      transactions: z.array(transactionSchema).min(1).max(16).describe('Array of transactions to simulate (max 16)'),
      allowMoreLogging: z.boolean().optional().describe('Lift log limits for verbose output'),
      allowUnnamedResources: z.boolean().optional().describe('Allow unnamed resources in app calls'),
      extraOpcodeBudget: z.number().optional().describe('Additional opcode budget for complex contracts'),
      execTraceConfig: z.object({
        enable: z.boolean().optional().describe('Enable execution tracing'),
        scratchChange: z.boolean().optional().describe('Track scratch space changes'),
        stackChange: z.boolean().optional().describe('Track stack changes'),
        stateChange: z.boolean().optional().describe('Track global/local/box state changes'),
      }).optional().describe('Execution tracing configuration for debugging'),
    }),
    handler: async ({ algorand, args, resolveSender, resolveAppSpec }) => {
      const {
        transactions,
        allowMoreLogging,
        allowUnnamedResources,
        extraOpcodeBudget,
        execTraceConfig,
      } = args
      return simulateTransactions(
        { transactions, allowMoreLogging, allowUnnamedResources, extraOpcodeBudget, execTraceConfig },
        algorand,
        resolveSender,
        resolveAppSpec
      )
    },
  },
]
