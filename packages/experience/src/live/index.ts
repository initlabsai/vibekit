/**
 * Provisional live host wiring for the Explorer payment flow: one shared
 * factory both renderers import (`@initlabs/vibekit-experience/live`) so the
 * compose-only deployment and group decoding are never copied per app. It is
 * not part of the browser-safe root export; Phase 7's hosted API absorbs it.
 */
import algosdk from 'algosdk'
import {
  base64ToBytes,
  bytesToBase64,
  executeToolCall,
  resolveDeployment,
  type AnyTool,
  type ResolvedDeployment,
} from '@initlabs/vibekit-core'
import { accountTools } from '@initlabs/vibekit-tools-accounts'
import { transactionTools, transactionWriteTools } from '@initlabs/vibekit-tools-transactions'

import { buildAccountPortfolioRecord } from '../live-account.js'
import { buildTransactionDetailRecord } from '../live-transaction.js'
import {
  buildPaymentConfirmationRecord,
  buildPaymentDraftRecord,
  buildPaymentSignedGroupRecord,
  buildPaymentSimulationRecord,
  decodedPaymentFactsSchema,
  type DecodedPaymentFacts,
} from '../live-payment.js'
import { paymentDraftDataSchema, paymentSignedGroupDataSchema } from '../payments.js'
import type { StructuredResult } from '../results.js'

/**
 * Decodes the authoritative facts of one unsigned payment group. This slice
 * supports exactly one plain pay transaction: anything else — groups, other
 * types, account-closing payments — is refused rather than partially shown.
 */
export function decodePaymentGroup(transactions: readonly string[]): DecodedPaymentFacts {
  if (transactions.length !== 1) {
    throw new Error(`Unsupported group size for the payment slice: ${transactions.length}`)
  }
  const txn = algosdk.decodeUnsignedTransaction(base64ToBytes(transactions[0]!))
  if (txn.type !== algosdk.TransactionType.pay || !txn.payment) {
    throw new Error(`Unsupported transaction type for the payment slice: ${txn.type}`)
  }
  if (txn.payment.closeRemainderTo !== undefined) {
    throw new Error('Account-closing payments are not part of the payment slice')
  }
  const note = txn.note && txn.note.length > 0 ? new TextDecoder().decode(txn.note) : undefined
  return decodedPaymentFactsSchema.parse({
    sender: txn.sender.toString(),
    receiver: txn.payment.receiver.toString(),
    amountMicroAlgos: Number(txn.payment.amount),
    feeMicroAlgos: Number(txn.fee),
    ...(note === undefined ? {} : { note }),
    transactionTypes: [txn.type],
  })
}

/** Decodes a draft record's group into algosdk transactions for a signer. */
export function unsignedTransactionsForDraft(draftRecord: StructuredResult): algosdk.Transaction[] {
  if (draftRecord.state !== 'success') {
    throw new Error('Cannot decode a failed draft record')
  }
  const draft = paymentDraftDataSchema.parse(draftRecord.data)
  return draft.unsignedGroup.transactions.map((txn) =>
    algosdk.decodeUnsignedTransaction(base64ToBytes(txn)),
  )
}

/**
 * Wraps signer output as a signed-group record after verifying that every
 * signed transaction embeds exactly the draft's bytes — a signature over
 * anything but the approved group is refused, not recorded.
 */
export function signedGroupRecordFor(
  identity: { resultId: string; toolCallId: string; network: string },
  draftRecord: StructuredResult,
  signedTransactions: readonly Uint8Array[],
): StructuredResult {
  if (draftRecord.state !== 'success') {
    throw new Error('Cannot sign a failed draft record')
  }
  const draft = paymentDraftDataSchema.parse(draftRecord.data)
  if (signedTransactions.length !== draft.unsignedGroup.transactions.length) {
    throw new Error('Signed group size does not match the drafted group')
  }
  const txIds: string[] = []
  for (const [index, signed] of signedTransactions.entries()) {
    const decoded = algosdk.decodeSignedTransaction(signed)
    const embedded = bytesToBase64(algosdk.encodeUnsignedTransaction(decoded.txn))
    if (embedded !== draft.unsignedGroup.transactions[index]) {
      throw new Error(`Signed transaction ${index} does not wrap the drafted bytes`)
    }
    txIds.push(decoded.txn.txID())
  }
  return buildPaymentSignedGroupRecord(identity, {
    transactions: signedTransactions.map((signed) => bytesToBase64(signed)),
    txIds,
    signer: draft.sender,
  })
}

/** Builds a draft record from a compose-mode send_payment wire result. */
export function draftRecordFromComposeWire(
  identity: { resultId: string; toolCallId: string; network: string },
  wire: unknown,
): StructuredResult {
  const { unsignedGroup } = wire as { unsignedGroup: string[] }
  const decoded = decodePaymentGroup(unsignedGroup)
  return buildPaymentDraftRecord(identity, wire, decoded)
}

/** Parameters for composing one live unsigned payment. */
export interface LivePaymentParams {
  sender: string
  receiver: string
  amountMicroAlgos: number
  note?: string
}

/** A signerless compose-only host for the live Explorer payment flow. */
export interface PaymentComposeHost {
  network: string
  /** True when the network's algod answers within the timeout. */
  probe(timeoutMs?: number): Promise<boolean>
  /** Composes a real unsigned payment and wraps it as a draft record. */
  draftPayment(params: LivePaymentParams): Promise<StructuredResult>
  /** Simulates the payment decoded from a draft record's actual group bytes. */
  simulateDraft(draftRecord: StructuredResult): Promise<StructuredResult>
  /**
   * Submits an already-signed group and waits for confirmation. Holds no
   * custody: it can only broadcast bytes some signer produced elsewhere.
   */
  submitSigned(signedRecord: StructuredResult): Promise<StructuredResult>
  /** Looks an account's portfolio up as an authoritative record. */
  lookupAccount(address: string): Promise<StructuredResult>
  /** Looks a transaction up as an authoritative record. */
  lookupTransaction(txid: string): Promise<StructuredResult>
}

function requireTool(deployment: ResolvedDeployment, name: string): AnyTool {
  const tool = deployment.tools.find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`Deployment is missing ${name}`)
  return tool
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

/** The named networks the live host can serve (core ships their endpoints). */
export type LiveNetworkId = 'localnet' | 'testnet' | 'mainnet'

/**
 * Creates the shared live host: a compose-only (signerless) deployment over
 * the transaction write tools on one named network. No signing, submission,
 * or key material is reachable from here by construction.
 */
export function createPaymentComposeHost(network: LiveNetworkId = 'localnet'): PaymentComposeHost {
  const deployment = resolveDeployment({
    network,
    mode: 'compose',
    tools: [
      ...transactionWriteTools,
      ...transactionTools.filter((tool) => tool.name === 'lookup_transaction'),
      ...accountTools.filter((tool) => tool.name === 'get_account_portfolio'),
    ],
  })
  const sendPayment = requireTool(deployment, 'send_payment')
  const simulateTransactions = requireTool(deployment, 'simulate_transactions')
  const accountPortfolio = requireTool(deployment, 'get_account_portfolio')
  const lookupTransactionTool = requireTool(deployment, 'lookup_transaction')
  const context = deployment.contexts.get(network)
  if (!context) throw new Error(`Deployment is missing network ${network}`)

  return {
    network,
    async probe(timeoutMs = 1500) {
      try {
        await Promise.race([
          context.algod.status().do(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('probe timeout')), timeoutMs),
          ),
        ])
        return true
      } catch {
        return false
      }
    },
    async draftPayment(params) {
      const wire = await executeToolCall(deployment, sendPayment, {
        sender: params.sender,
        receiver: params.receiver,
        amountMicroAlgos: params.amountMicroAlgos,
        ...(params.note === undefined ? {} : { note: params.note }),
      })
      return draftRecordFromComposeWire(
        {
          resultId: newId('result-live-payment-draft'),
          toolCallId: newId('tool-call-live-payment-draft'),
          network,
        },
        wire,
      )
    },
    async simulateDraft(draftRecord) {
      if (draftRecord.state !== 'success') {
        throw new Error('Cannot simulate a failed draft record')
      }
      const draft = paymentDraftDataSchema.parse(draftRecord.data)
      // The group bytes, not the request parameters, are the simulated truth.
      const decoded = decodePaymentGroup(draft.unsignedGroup.transactions)
      const wire = await executeToolCall(deployment, simulateTransactions, {
        transactions: [
          {
            type: 'payment',
            sender: decoded.sender,
            receiver: decoded.receiver,
            amount: Number(decoded.amountMicroAlgos),
            ...(decoded.note === undefined ? {} : { note: decoded.note }),
          },
        ],
      })
      return buildPaymentSimulationRecord(
        {
          resultId: newId('result-live-payment-simulation'),
          toolCallId: newId('tool-call-live-payment-simulation'),
          network: draftRecord.network,
        },
        wire,
        decoded,
      )
    },
    async submitSigned(signedRecord) {
      if (signedRecord.state !== 'success') {
        throw new Error('Cannot submit a failed signed record')
      }
      const signed = paymentSignedGroupDataSchema.parse(signedRecord.data)
      const bytes = signed.transactions.map((txn) => base64ToBytes(txn))
      const { txid } = await context.algod.sendRawTransaction(bytes).do()
      const confirmation = await algosdk.waitForConfirmation(context.algod, txid, 4)
      return buildPaymentConfirmationRecord(
        {
          resultId: newId('result-live-payment-confirmation'),
          toolCallId: newId('tool-call-live-payment-confirmation'),
          network: signedRecord.network,
        },
        { transactionId: txid, confirmedRound: Number(confirmation.confirmedRound) },
      )
    },
    async lookupAccount(address) {
      const wire = await executeToolCall(deployment, accountPortfolio, { address })
      return buildAccountPortfolioRecord(
        {
          resultId: newId('result-live-account'),
          toolCallId: newId('tool-call-live-account'),
          network,
        },
        wire,
      )
    },
    async lookupTransaction(txid) {
      const wire = await executeToolCall(deployment, lookupTransactionTool, { txid })
      return buildTransactionDetailRecord(
        {
          resultId: newId('result-live-transaction'),
          toolCallId: newId('tool-call-live-transaction'),
          network,
        },
        wire,
      )
    },
  }
}
