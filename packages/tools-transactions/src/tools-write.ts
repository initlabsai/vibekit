/** Write tools: send_payment, send_group_transactions, simulate_transactions. */
import {
  composeOrExecute,
  defineTool,
  simulateGroup,
  writeResultSchema,
  type AnyTool,
  type TxnSpec,
} from '@initlabs/vibekit-core'
import { z } from 'zod'

/**
 * One TxnSpec as zod — the JSON shape agents produce for grouped transactions.
 * Sender is required on every txn: there is no ambient active account (§10).
 */
export const txnSpecSchema = z.object({
  type: z
    .enum([
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
    ])
    .describe('Transaction type'),
  sender: z.string().describe('Sender address (required — no ambient account)'),
  receiver: z.string().optional().describe('(payment, asset_transfer) Receiver address'),
  amount: z
    .number()
    .optional()
    .describe('(payment) microALGO. (asset_transfer) base units of the asset'),
  closeRemainderTo: z
    .string()
    .optional()
    .describe('(payment) Address receiving remaining balance — CLOSES the account; requires confirmCloseAccount: true'),
  confirmCloseAccount: z
    .boolean()
    .optional()
    .describe('Must be true when closing (closeRemainderTo/closeAssetTo) — the position is emptied'),
  confirmClearRoles: z
    .boolean()
    .optional()
    .describe('(asset_config) Must be true to clear omitted role addresses (permanent)'),
  assetId: z.number().optional().describe('(asset_*) The asset ID'),
  total: z.number().optional().describe('(asset_create) Total supply'),
  decimals: z.number().optional().describe('(asset_create) Decimals (0-19)'),
  assetName: z.string().optional().describe('(asset_create) Asset name'),
  unitName: z.string().optional().describe('(asset_create) Unit name'),
  url: z.string().optional().describe('(asset_create) Asset URL'),
  metadataHash: z
    .string()
    .optional()
    .describe('(asset_create) 32-byte metadata hash (64 hex or 44 base64 chars)'),
  defaultFrozen: z.boolean().optional().describe('(asset_create) Holdings frozen by default'),
  manager: z.string().optional().describe('(asset_create, asset_config) Manager address'),
  reserve: z.string().optional().describe('(asset_create, asset_config) Reserve address'),
  freeze: z.string().optional().describe('(asset_create, asset_config) Freeze address'),
  clawback: z.string().optional().describe('(asset_create, asset_config) Clawback address'),
  freezeTarget: z.string().optional().describe('(asset_freeze) Account to freeze/unfreeze'),
  frozen: z.boolean().optional().describe('(asset_freeze) Freeze (true) or unfreeze (false)'),
  clawbackTarget: z
    .string()
    .optional()
    .describe('(asset_transfer) Clawback: the account to claw back from'),
  closeAssetTo: z
    .string()
    .optional()
    .describe('(asset_opt_out, asset_transfer) Account receiving remaining asset balance'),
  ensureZeroBalance: z
    .boolean()
    .optional()
    .describe('(asset_opt_out) Fail if balance is non-zero. Default: true'),
  appId: z.number().optional().describe('(app_*) The application ID'),
  methodSignature: z
    .string()
    .optional()
    .describe('(app_*) ARC-4 method signature, e.g. "hello(string)string"'),
  appSpec: z.string().optional().describe('(app_*) Full ARC-56/32 app spec JSON string'),
  method: z.string().optional().describe('(app_*) Method name to look up in appSpec'),
  args: z
    .array(z.any())
    .optional()
    .describe(
      '(app_*) Method arguments. Transaction-typed args are objects: {"type":"pay","receiver":"...","amount":1000}',
    ),
  extraFee: z
    .number()
    .optional()
    .describe('(app_*) Extra fee in microALGO to cover inner transactions (1000 per inner txn)'),
  maxFee: z.number().optional().describe('(app_*) Max fee in microALGO'),
  note: z.string().optional().describe('Optional note (max 1000 bytes)'),
})

const GROUP_DESCRIPTION = `Send 1-16 transactions as an atomic group — all succeed or all fail.

Types and required fields (sender always required):
- payment: receiver, amount
- asset_transfer: assetId, receiver, amount (optional: clawbackTarget, closeAssetTo)
- asset_opt_in: assetId · asset_opt_out: assetId, closeAssetTo
- asset_create: total (optional: decimals, assetName, unitName, url, metadataHash, defaultFrozen, manager, reserve, freeze, clawback)
- asset_config: assetId · asset_freeze: assetId, freezeTarget, frozen · asset_destroy: assetId
- app_call/app_opt_in/app_close_out/app_delete: appId + (methodSignature OR appSpec + method) (optional: args, extraFee, maxFee)

ABI transaction args (pay/axfer/acfg/afrz) are passed as objects in args, e.g. optInToAsset(pay,uint64)void:
args: [{"type":"pay","receiver":"APPADDR","amount":200000}, 1659]

Inner transaction fees: use extraFee (1000 microALGO per inner txn with fee 0).
In compose mode this returns unsigned transactions for external signing instead of executing.`

export const transactionWriteTools: AnyTool[] = [
  defineTool({
    name: 'send_payment',
    description:
      'Send a payment of microALGO from sender to receiver. In compose mode returns the unsigned transaction for external signing.',
    parameters: z.object({
      sender: z.string().describe('Sender address'),
      receiver: z.string().describe('Receiver address'),
      amountMicroAlgos: z.number().int().positive().describe('Amount in microALGO'),
      confirmCloseAccount: z
        .boolean()
        .optional()
        .describe('Must be true when closeRemainderTo is set — closing empties the account'),
      closeRemainderTo: z
        .string()
        .optional()
        .describe('Address receiving remaining balance — closes the sender account'),
      note: z.string().optional().describe('Optional UTF-8 note'),
    }),
    output: writeResultSchema,
    requiresSigner: true,
    display: 'txn',
    handler: async (ctx, args) =>
      composeOrExecute(ctx, [
        {
          type: 'payment',
          sender: args.sender,
          receiver: args.receiver,
          amount: args.amountMicroAlgos,
          closeRemainderTo: args.closeRemainderTo,
          confirmCloseAccount: args.confirmCloseAccount,
          note: args.note,
        },
      ]),
  }),
  defineTool({
    name: 'send_group_transactions',
    description: GROUP_DESCRIPTION,
    parameters: z.object({
      transactions: z.array(txnSpecSchema).min(1).max(16),
    }),
    output: writeResultSchema,
    requiresSigner: true,
    display: 'txn',
    handler: async (ctx, args) => composeOrExecute(ctx, args.transactions as TxnSpec[]),
  }),
  defineTool({
    name: 'simulate_transactions',
    description:
      'Simulate 1-16 transactions as a group WITHOUT sending: dry-run outcomes, ABI returns, logs, opcode budgets. No signatures needed. Same transaction shapes as send_group_transactions.',
    parameters: z.object({
      transactions: z.array(txnSpecSchema).min(1).max(16),
      allowMoreLogging: z.boolean().optional().describe('Lift log limits during simulation'),
      allowUnnamedResources: z.boolean().optional().describe('Allow unnamed resource access'),
      extraOpcodeBudget: z.number().optional().describe('Extra opcode budget to grant'),
    }),
    output: z.object({
      wouldSucceed: z.boolean(),
      failureMessage: z.string().optional(),
      failedAt: z.array(z.number()).optional(),
      simulatedRound: z.number(),
      txids: z.array(z.string()),
      transactionResults: z.array(
        z.object({
          txid: z.string(),
          logs: z.array(z.string()).optional(),
          budgetConsumed: z.number().optional(),
        }),
      ),
      returns: z.array(z.object({ index: z.number(), value: z.unknown() })),
      appBudgetAdded: z.number().optional(),
      appBudgetConsumed: z.number().optional(),
    }),
    display: 'json',
    handler: async (ctx, args) =>
      simulateGroup(ctx, args.transactions as TxnSpec[], {
        allowMoreLogging: args.allowMoreLogging,
        allowUnnamedResources: args.allowUnnamedResources,
        extraOpcodeBudget: args.extraOpcodeBudget,
      }),
  }),
] as AnyTool[]
