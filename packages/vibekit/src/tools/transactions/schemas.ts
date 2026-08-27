import { z } from 'zod'
import { formattedTransactionSchema } from '../shared/schemas.js'

/** Wire shape of lookup_transaction_group ('transaction.group' view). */
export const transactionGroupSchema = z.object({
  groupId: z.string(),
  transactions: z.array(formattedTransactionSchema),
  nextToken: z.string().optional(),
})
