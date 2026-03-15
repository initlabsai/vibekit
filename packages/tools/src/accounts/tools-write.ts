import { z } from 'zod'
import type { ToolDefinition } from '@vibekit/core'
import { sendPayment } from './handlers/write'

export const accountWriteTools: ToolDefinition[] = [
  {
    name: 'send_payment',
    description:
      'Send a payment transaction (ALGO transfer). ' +
      'Signs using the active account - use switch_account first to select the sender. ' +
      'Amount is in microALGO (1 ALGO = 1,000,000 microALGO).',
    parameters: z.object({
      receiver: z.string().describe('The receiver address'),
      amount: z.number().describe('Amount to send in microALGO (1 ALGO = 1,000,000 microALGO)'),
      sender: z
        .string()
        .optional()
        .describe(
          'Sender address. Defaults to active account. If specifying a different address, switch_account to that account first.'
        ),
      note: z
        .string()
        .optional()
        .describe('Optional note to include with the transaction (max 1000 bytes)'),
      closeRemainderTo: z
        .string()
        .optional()
        .describe(
          'Optional address to receive remaining balance. Use this to close an account. Warning: This will transfer ALL remaining ALGO and remove the account from the ledger.'
        ),
    }),
    handler: async ({ algorand, args, resolveSender }) =>
      sendPayment(algorand, args, resolveSender),
  },
]
