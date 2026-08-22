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
import {
  accountTools,
  assetTools,
  contractTools,
  networkTools,
  transactionTools,
  transactionWriteTools,
} from '@initlabs/vibekit-tools'

import { buildAccountListRecord, buildAccountPortfolioRecord } from '../views/account.js'
import {
  buildApplicationDetailRecord,
  buildApplicationLocalsRecord,
} from '../views/application.js'
import { buildAssetDetailRecord, buildAssetHoldingsRecord } from '../views/asset.js'
import { buildBlockDetailRecord } from '../views/block.js'
import {
  buildTransactionDetailRecord,
  buildTransactionGroupRecord,
  buildTransactionListRecord,
  type TransactionSearchFilter,
} from '../views/transaction.js'
import { formatAlgodTransaction, printableNote, safeUint64 } from './algod-txn.js'
import { tickFromAlgodBlock, type BlockTailTick } from './block-tail.js'
import {
  buildPaymentConfirmationRecord,
  buildPaymentDraftRecord,
  buildPaymentSignedGroupRecord,
  buildPaymentSimulationRecord,
  decodedPaymentFactsSchema,
  type DecodedPaymentFacts,
} from '../flows/payment-live.js'
import { paymentDraftDataSchema, paymentSignedGroupDataSchema } from '../flows/payment.js'
import type { StructuredResult } from '../core/results.js'



/**
 * Decodes the authoritative facts of an unsigned group of 1–16 transactions.
 * Payment receiver/amount are filled only when every transaction is a plain pay
 * and there is exactly one of them — mixed groups stay group-shaped.
 */
export function decodeUnsignedGroup(transactions: readonly string[]): DecodedPaymentFacts {
  if (transactions.length === 0 || transactions.length > 16) {
    throw new Error(`Unsupported group size: ${transactions.length}`)
  }
  const decoded = transactions.map((entry) => algosdk.decodeUnsignedTransaction(base64ToBytes(entry)))
  const graphTransactions = decoded.map((txn) => formatAlgodTransaction(txn))
  let fee = 0n
  for (const txn of decoded) fee += BigInt(txn.fee)
  const types = decoded.map((txn) => String(txn.type))
  const note = printableNote(decoded[0]?.note)
  const singlePay =
    decoded.length === 1 &&
    decoded[0]!.type === algosdk.TransactionType.pay &&
    decoded[0]!.payment &&
    decoded[0]!.payment.closeRemainderTo === undefined
  return decodedPaymentFactsSchema.parse({
    sender: decoded[0]!.sender.toString(),
    ...(singlePay
      ? {
          receiver: decoded[0]!.payment!.receiver.toString(),
          amountMicroAlgos: safeUint64(decoded[0]!.payment!.amount),
        }
      : {}),
    feeMicroAlgos: safeUint64(fee),
    ...(note === undefined ? {} : { note }),
    transactionTypes: types,
    graphTransactions,
  })
}

/**
 * Simulates the exact unsigned group bytes (empty signatures allowed). Used
 * by the live host so approval reviews the drafted transactions, not a
 * reconstructed spec.
 */
export async function simulateUnsignedGroup(
  algod: algosdk.Algodv2,
  transactions: readonly string[],
): Promise<{
  wouldSucceed: boolean
  failureMessage?: string
  simulatedRound: number
  txids: string[]
}> {
  const emptySigner = algosdk.makeEmptyTransactionSigner()
  const atc = new algosdk.AtomicTransactionComposer()
  for (const encoded of transactions) {
    atc.addTransaction({
      txn: algosdk.decodeUnsignedTransaction(base64ToBytes(encoded)),
      signer: emptySigner,
    })
  }
  const request = new algosdk.modelsv2.SimulateRequest({
    txnGroups: [],
    allowEmptySignatures: true,
  })
  const { simulateResponse } = await atc.simulate(algod, request)
  const group = simulateResponse.txnGroups[0]
  const txids = atc.buildGroup().map((entry) => entry.txn.txID())
  return {
    wouldSucceed: !group?.failureMessage,
    ...(group?.failureMessage ? { failureMessage: group.failureMessage } : {}),
    simulatedRound: Number(simulateResponse.lastRound),
    txids,
  }
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

/** Builds a draft record from a compose-mode unsigned-group wire result. */
export function draftRecordFromComposeWire(
  identity: { resultId: string; toolCallId: string; network: string },
  wire: unknown,
  toolName = 'send_payment',
): StructuredResult {
  const { unsignedGroup } = wire as { unsignedGroup: string[] }
  const decoded = decodeUnsignedGroup(unsignedGroup)
  return buildPaymentDraftRecord(identity, wire, decoded, toolName)
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
  /** Looks several accounts up as one account.list record. */
  lookupAccounts(addresses: readonly string[]): Promise<StructuredResult>
  /** Looks a transaction up as an authoritative record. */
  lookupTransaction(txid: string): Promise<StructuredResult>
  /** Looks every transaction in an atomic group up as one transaction.group record. */
  lookupTransactionGroup(groupId: string): Promise<StructuredResult>
  /** Looks an ASA up as an authoritative record. */
  lookupAsset(assetId: number): Promise<StructuredResult>
  /** Looks an application up as an authoritative record. */
  lookupApplication(applicationId: number): Promise<StructuredResult>
  /** Looks a block up as an authoritative record. */
  lookupBlock(round: number): Promise<StructuredResult>
  /** Lists assets held by an account. */
  lookupAccountAssets(address: string): Promise<StructuredResult>
  /** Lists application local state for apps an account has opted into. */
  lookupAccountAppStates(address: string): Promise<StructuredResult>
  /** Lists transactions involving an account. */
  lookupAccountTransactions(address: string): Promise<StructuredResult>
  /** One page of transactions scoped by account, asset, application, or round. */
  searchTransactions(filter: TransactionSearchFilter): Promise<StructuredResult>
  /** Current algod lastRound. */
  statusRound(): Promise<{ lastRound: number }>
  /** Resolves when lastRound is greater than `round` (algod wait-for-block). */
  waitAfterBlock(round: number): Promise<{ lastRound: number }>
  /** Reads one confirmed round from algod as feed-ready block + transaction records. */
  readBlockTick(round: number): Promise<BlockTailTick>
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
      ...transactionTools.filter((tool) =>
        ['lookup_transaction', 'lookup_transaction_group', 'search_transactions'].includes(tool.name),
      ),
      ...accountTools.filter((tool) =>
        [
          'get_account_portfolio',
          'batch_lookup_accounts',
          'get_account_assets',
          'get_account_app_local_states',
          'search_account_transactions',
        ].includes(tool.name),
      ),
      ...assetTools.filter((tool) => tool.name === 'lookup_asset'),
      ...contractTools.filter((tool) => tool.name === 'lookup_application'),
      ...networkTools.filter((tool) => tool.name === 'lookup_block'),
    ],
  })
  const sendPayment = requireTool(deployment, 'send_payment')
  const accountPortfolio = requireTool(deployment, 'get_account_portfolio')
  const batchLookupAccounts = requireTool(deployment, 'batch_lookup_accounts')
  const lookupTransactionTool = requireTool(deployment, 'lookup_transaction')
  const lookupTransactionGroupTool = requireTool(deployment, 'lookup_transaction_group')
  const lookupAssetTool = requireTool(deployment, 'lookup_asset')
  const lookupApplicationTool = requireTool(deployment, 'lookup_application')
  const lookupBlockTool = requireTool(deployment, 'lookup_block')
  const accountAssetsTool = requireTool(deployment, 'get_account_assets')
  const accountAppStatesTool = requireTool(deployment, 'get_account_app_local_states')
  const accountTransactionsTool = requireTool(deployment, 'search_account_transactions')
  const searchTransactionsTool = requireTool(deployment, 'search_transactions')
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
      // The group bytes, not reconstructed specs, are the simulated truth.
      const decoded = decodeUnsignedGroup(draft.unsignedGroup.transactions)
      const wire = await simulateUnsignedGroup(context.algod, draft.unsignedGroup.transactions)
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
    async lookupAccounts(addresses) {
      const wire = await executeToolCall(deployment, batchLookupAccounts, {
        addresses: [...addresses],
      })
      return buildAccountListRecord(
        {
          resultId: newId('result-live-accounts'),
          toolCallId: newId('tool-call-live-accounts'),
          network,
        },
        wire,
        'batch_lookup_accounts',
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
    async lookupTransactionGroup(groupId) {
      const wire = await executeToolCall(deployment, lookupTransactionGroupTool, { groupId })
      return buildTransactionGroupRecord(
        {
          resultId: newId('result-live-transaction-group'),
          toolCallId: newId('tool-call-live-transaction-group'),
          network,
        },
        wire,
      )
    },
    async lookupAsset(assetId) {
      const wire = await executeToolCall(deployment, lookupAssetTool, { assetId })
      return buildAssetDetailRecord(
        {
          resultId: newId('result-live-asset'),
          toolCallId: newId('tool-call-live-asset'),
          network,
        },
        wire,
      )
    },
    async lookupApplication(applicationId) {
      const wire = await executeToolCall(deployment, lookupApplicationTool, { applicationId })
      return buildApplicationDetailRecord(
        {
          resultId: newId('result-live-application'),
          toolCallId: newId('tool-call-live-application'),
          network,
        },
        wire,
      )
    },
    async lookupBlock(round) {
      const wire = await executeToolCall(deployment, lookupBlockTool, { round })
      return buildBlockDetailRecord(
        {
          resultId: newId('result-live-block'),
          toolCallId: newId('tool-call-live-block'),
          network,
        },
        wire,
      )
    },
    async lookupAccountAssets(address) {
      const wire = await executeToolCall(deployment, accountAssetsTool, { address })
      return buildAssetHoldingsRecord(
        {
          resultId: newId('result-live-account-assets'),
          toolCallId: newId('tool-call-live-account-assets'),
          network,
        },
        wire,
        'get_account_assets',
      )
    },
    async lookupAccountAppStates(address) {
      const wire = await executeToolCall(deployment, accountAppStatesTool, { address })
      return buildApplicationLocalsRecord(
        {
          resultId: newId('result-live-account-apps'),
          toolCallId: newId('tool-call-live-account-apps'),
          network,
        },
        { ...(wire as object), address },
        'get_account_app_local_states',
      )
    },
    async searchTransactions(filter) {
      const { address, assetId, applicationId, round, txType, nextToken } = filter
      const page = {
        limit: 20,
        ...(nextToken ? { nextToken } : {}),
        ...(txType ? { txType } : {}),
      }
      const wire = address
        ? await executeToolCall(deployment, accountTransactionsTool, {
            ...page,
            address,
            ...(assetId === undefined ? {} : { assetId }),
          })
        : await executeToolCall(deployment, searchTransactionsTool, {
            ...page,
            ...(assetId === undefined ? {} : { assetId }),
            ...(applicationId === undefined ? {} : { applicationId }),
            ...(round === undefined ? {} : { minRound: round, maxRound: round }),
          })
      return buildTransactionListRecord(
        {
          resultId: newId('result-live-txn-search'),
          toolCallId: newId('tool-call-live-txn-search'),
          network,
        },
        { ...(wire as object), ...(address ? { address } : {}) },
        address ? 'search_account_transactions' : 'search_transactions',
      )
    },
    async lookupAccountTransactions(address) {
      const wire = await executeToolCall(deployment, accountTransactionsTool, {
        address,
        limit: 20,
      })
      return buildTransactionListRecord(
        {
          resultId: newId('result-live-account-txns'),
          toolCallId: newId('tool-call-live-account-txns'),
          network,
        },
        { ...(wire as object), address },
        'search_account_transactions',
      )
    },
    async statusRound() {
      const status = await context.algod.status().do()
      return { lastRound: Number(status.lastRound) }
    },
    async waitAfterBlock(round) {
      const status = await context.algod.statusAfterBlock(round).do()
      return { lastRound: Number(status.lastRound) }
    },
    async readBlockTick(round) {
      const response = await context.algod.block(round).do()
      const header = response.block.header
      const payset = response.block.payset ?? []
      return tickFromAlgodBlock(
        {
          resultId: newId('result-live-block-tick'),
          toolCallId: newId('tool-call-live-block-tick'),
          network,
        },
        header,
        payset.map((entry) => ({
          txn: entry.signedTxn.signedTxn.txn,
          hasGenesisID: entry.hasGenesisID,
          hasGenesisHash: entry.hasGenesisHash,
          apply: entry.signedTxn.applyData,
        })),
      )
    },
  }
}

export {
  matchesInTick,
  runBlockTail,
  tickFromAlgodBlock,
  withRelated,
  type BlockTailClock,
  type BlockTailMatch,
  type BlockTailTick,
  type BlockTailWatch,
} from './block-tail.js'
