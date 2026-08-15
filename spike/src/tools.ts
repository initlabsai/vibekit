/** Spike tools: two reads (bigint-heavy responses) and one write (send_payment). */
import algosdk from 'algosdk'
import { z } from 'zod'
import { defineTool, ToolError, type AnyTool, type UnsignedGroupResult } from './contract'

export const getNetworkStatus = defineTool({
  name: 'get_network_status',
  description: 'Get current Algorand network status: last round, catchup state, consensus version.',
  parameters: z.object({}),
  display: 'json',
  handler: async (ctx) => {
    const status = await ctx.algod.status().do()
    return {
      network: ctx.network,
      lastRound: status.lastRound,
      timeSinceLastRound: status.timeSinceLastRound,
      catchupTime: status.catchupTime,
    }
  },
})

export const getAccountInfo = defineTool({
  name: 'get_account_info',
  description: 'Get an Algorand account: balance (microALGO), status, asset/app counts.',
  parameters: z.object({
    address: z.string().describe('Algorand address (58 chars)'),
  }),
  display: 'account',
  handler: async (ctx, args) => {
    if (!algosdk.isValidAddress(args.address)) {
      throw new ToolError('INVALID_ADDRESS', `Not a valid Algorand address: ${args.address}`)
    }
    const info = await ctx.algod.accountInformation(args.address).do()
    return {
      address: args.address,
      balanceMicroAlgos: info.amount,
      minBalanceMicroAlgos: info.minBalance,
      status: info.status,
      totalAssetsOptedIn: info.totalAssetsOptedIn,
      totalAppsOptedIn: info.totalAppsOptedIn,
      round: info.round,
    }
  },
})

export const sendPayment = defineTool({
  name: 'send_payment',
  description:
    'Send a payment of microALGO from sender to receiver. In compose mode returns unsigned transactions for external signing instead of executing.',
  parameters: z.object({
    sender: z.string().describe('Sender address'),
    receiver: z.string().describe('Receiver address'),
    amountMicroAlgos: z.number().int().positive().describe('Amount in microALGO'),
    note: z.string().optional().describe('Optional UTF-8 note'),
  }),
  requiresSigner: true,
  display: 'txn',
  handler: async (ctx, args) => {
    for (const [label, addr] of [
      ['sender', args.sender],
      ['receiver', args.receiver],
    ] as const) {
      if (!algosdk.isValidAddress(addr)) {
        throw new ToolError('INVALID_ADDRESS', `Invalid ${label} address: ${addr}`)
      }
    }

    const suggestedParams = await ctx.algod.getTransactionParams().do()
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: args.sender,
      receiver: args.receiver,
      amount: args.amountMicroAlgos,
      note: args.note ? new TextEncoder().encode(args.note) : undefined,
      suggestedParams,
    })

    if (ctx.mode === 'compose') {
      const result: UnsignedGroupResult = {
        unsignedGroup: [Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64')],
        summary: `Payment of ${args.amountMicroAlgos} microALGO from ${args.sender} to ${args.receiver}`,
      }
      return result
    }

    if (!ctx.resolveSigner) {
      throw new ToolError('NO_SIGNER', 'This deployment has no signer configured; use compose mode.')
    }
    const signer = await ctx.resolveSigner(args.sender)
    const [signed] = await signer([txn], [0])
    if (!signed) throw new ToolError('SIGNING_FAILED', 'Signer returned no signature')

    const { txid } = await ctx.algod.sendRawTransaction(signed).do()
    const confirmed = await algosdk.waitForConfirmation(ctx.algod, txid, 4)
    return {
      txid,
      confirmedRound: confirmed.confirmedRound,
      sender: args.sender,
      receiver: args.receiver,
      amountMicroAlgos: args.amountMicroAlgos,
    }
  },
})

export const spikeTools: AnyTool[] = [getNetworkStatus, getAccountInfo, sendPayment] as AnyTool[]
