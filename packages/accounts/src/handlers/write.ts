/**
 * Account write handlers
 *
 * Domain logic for account payment operations.
 */

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { ResolveSenderFn } from '@vibekit/core'
import {
  validateRequiredAddress,
  validateRequiredAmount,
  validateOptionalAddress,
  validateNote,
} from '@vibekit/core'
import { sendTransactions } from '@vibekit/transactions'

export interface SendPaymentArgs {
  receiver: string
  amount: number
  sender?: string
  note?: string
  closeRemainderTo?: string
}

export async function sendPayment(
  algorand: AlgorandClient,
  args: SendPaymentArgs,
  resolveSender: ResolveSenderFn
) {
  const { receiver, amount, sender, note, closeRemainderTo } = args

  validateRequiredAddress(receiver, 'receiver')
  validateRequiredAmount(amount)
  validateOptionalAddress(closeRemainderTo, 'closeRemainderTo')
  if (note) validateNote(note)

  const { address: senderAddress } = await resolveSender(algorand, sender)

  const result = await sendTransactions(
    {
      transactions: [
        { type: 'payment', receiver, amount, sender, note, closeRemainderTo },
      ],
    },
    algorand,
    resolveSender
  )

  return {
    success: true,
    txId: result.txIds[0],
    from: senderAddress,
    to: receiver,
    amount: amount.toString(),
    closeRemainderTo,
    confirmedRound: result.confirmedRound,
  }
}
