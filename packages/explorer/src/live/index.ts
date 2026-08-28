/**
 * The live host: a compose-only (signerless) deployment over the vibekit tools
 * on one named network, wrapped so every call returns a StructuredResult. Both
 * Explorer apps import it (`@initlabs/vibekit-explorer/live`); it needs
 * algosdk and node, so it is not part of the browser-safe root export.
 */
import algosdk from 'algosdk'
import {
  base64ToBytes,
  bytesToBase64,
  executeToolCall,
  resolveDeployment,
  type AnyTool,
  type NetworkConfig,
  type ResolvedDeployment,
} from '@initlabs/vibekit'
import {
  accountTools,
  assetTools,
  contractTools,
  networkTools,
  transactionTools,
  transactionWriteTools,
} from '@initlabs/vibekit/tools'

import { bridgeToolResult } from '../bridge.js'
import type { ExplorerReadHost, LiveNetworkId } from '../host.js'
import { formatAlgodTransaction, printableNote, safeUint64 } from './algod-txn.js'
import { tickFromAlgodBlock, type BlockTailTick } from './block-tail.js'
import {
  buildConfirmationRecord,
  buildDraftRecord,
  buildSignedGroupRecord,
  buildSimulationRecord,
  decodedGroupFactsSchema,
  type DecodedGroupFacts,
} from '../flows/write-flow-host.js'
import { writeDraftDataSchema, signedGroupDataSchema } from '../flows/write-flow.js'
import type { JsonValue, StructuredResult } from '../core/results.js'

/**
 * Decodes the authoritative facts of an unsigned group of 1–16 transactions.
 * Payment receiver/amount are filled only when every transaction is a plain pay
 * and there is exactly one of them — mixed groups stay group-shaped.
 */
export function decodeUnsignedGroup(transactions: readonly string[]): DecodedGroupFacts {
  if (transactions.length === 0 || transactions.length > 16) {
    throw new Error(`Unsupported group size: ${transactions.length}`)
  }
  const decoded = transactions.map((entry) =>
    algosdk.decodeUnsignedTransaction(base64ToBytes(entry)),
  )
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
  return decodedGroupFactsSchema.parse({
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
  // The bytes are already a group (group ids set), so no ATC: it refuses
  // grouped transactions. Simulate the encoded group directly.
  const decoded = transactions.map((encoded) =>
    algosdk.decodeUnsignedTransaction(base64ToBytes(encoded)),
  )
  const request = new algosdk.modelsv2.SimulateRequest({
    txnGroups: [
      new algosdk.modelsv2.SimulateRequestTransactionGroup({
        txns: decoded.map((txn) =>
          algosdk.decodeSignedTransaction(algosdk.encodeUnsignedSimulateTransaction(txn)),
        ),
      }),
    ],
    allowEmptySignatures: true,
  })
  const simulateResponse = await algod.simulateTransactions(request).do()
  const group = simulateResponse.txnGroups[0]
  const txids = decoded.map((txn) => txn.txID())
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
  const draft = writeDraftDataSchema.parse(draftRecord.data)
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
  const draft = writeDraftDataSchema.parse(draftRecord.data)
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
  return buildSignedGroupRecord(identity, {
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
  return buildDraftRecord(identity, wire, decoded, toolName)
}

/** Parameters for composing one live unsigned payment. */
export interface LivePaymentParams {
  sender: string
  receiver: string
  amountMicroAlgos: number
  note?: string
}

/** What the live host offers: reads, the write-flow steps, and the block tail. Nothing here can sign. */
export interface LiveHost extends ExplorerReadHost {
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
  /** Broadcasts a signed group and returns at once; pair with `confirmation` to poll. */
  broadcastSigned(signedRecord: StructuredResult): Promise<{ txid: string }>
  /** The confirmation record once algod reports the transaction in a round; undefined while pending. */
  confirmation(txid: string): Promise<StructuredResult | undefined>
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

export type { LiveNetworkId }

/**
 * Creates the shared live host: a compose-only (signerless) deployment over
 * the transaction write tools on one network — a named id, or a NetworkConfig
 * carrying the caller's own endpoints. No signing or key material is
 * reachable from here by construction.
 */
export function createLiveHost(config: LiveNetworkId | NetworkConfig = 'localnet'): LiveHost {
  const network = typeof config === 'string' ? config : config.id
  const deployment = resolveDeployment({
    network: config,
    mode: 'compose',
    // Every read tool, so callTool can page any list an agent or a lane fetched.
    tools: [
      ...transactionWriteTools,
      ...[
        ...transactionTools,
        ...accountTools,
        ...assetTools,
        ...contractTools,
        ...networkTools,
      ].filter((tool) => !tool.mutatesState && !tool.requiresSigner),
    ],
  })
  const sendPayment = requireTool(deployment, 'send_payment')
  const context = deployment.contexts.get(network)
  if (!context) throw new Error(`Deployment is missing network ${network}`)

  /** Fresh paired ids for one live call's record. */
  const identity = (slug: string, extra?: { input?: JsonValue; network?: string }) => ({
    resultId: newId(`result-live-${slug}`),
    toolCallId: newId(`tool-call-live-${slug}`),
    network: extra?.network ?? network,
    ...(extra?.input === undefined ? {} : { input: extra.input }),
  })

  /**
   * Any of the deployment's tools by name. The tool's view id picks the record
   * builder; `input` is recorded so a list can re-run its own call for the
   * next page. Every read below is this.
   */
  const callTool = async (toolName: string, args: Record<string, unknown>) => {
    const tool = deployment.tools.find((candidate) => candidate.name === toolName)
    if (!tool) throw new Error(`This host has no tool named ${toolName}`)
    const id = newId('tool-call-live')
    const output = await executeToolCall(deployment, tool, args)
    // Hosts scope account lists by merging the address in; the tool's own wire lacks it.
    const wire =
      typeof args.address === 'string' &&
      output !== null &&
      typeof output === 'object' &&
      !Array.isArray(output)
        ? { ...(output as object), address: args.address }
        : output
    return bridgeToolResult(
      { id, toolName, output: wire, isError: false, ...(tool.view ? { view: tool.view } : {}) },
      { resultId: newId('result-live'), toolCallId: id, network, input: args as JsonValue },
    ).record
  }

  /** Broadcast only; confirmation is a separate poll so a caller need not hold a connection. */
  const broadcastSigned = async (signedRecord: StructuredResult): Promise<{ txid: string }> => {
    if (signedRecord.state !== 'success') {
      throw new Error('Cannot submit a failed signed record')
    }
    const signed = signedGroupDataSchema.parse(signedRecord.data)
    const bytes = signed.transactions.map((txn) => base64ToBytes(txn))
    const { txid } = await context.algod.sendRawTransaction(bytes).do()
    return { txid }
  }

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
      return draftRecordFromComposeWire(identity('payment-draft'), wire)
    },
    async simulateDraft(draftRecord) {
      if (draftRecord.state !== 'success') {
        throw new Error('Cannot simulate a failed draft record')
      }
      const draft = writeDraftDataSchema.parse(draftRecord.data)
      // The group bytes, not reconstructed specs, are the simulated truth.
      const decoded = decodeUnsignedGroup(draft.unsignedGroup.transactions)
      const wire = await simulateUnsignedGroup(context.algod, draft.unsignedGroup.transactions)
      return buildSimulationRecord(
        identity('payment-simulation', { network: draftRecord.network }),
        wire,
        decoded,
      )
    },
    broadcastSigned,
    async confirmation(txid) {
      const pending = await context.algod.pendingTransactionInformation(txid).do()
      if (pending.poolError) throw new Error(pending.poolError)
      const round = pending.confirmedRound
      if (round === undefined || Number(round) === 0) return undefined
      return buildConfirmationRecord(identity('payment-confirmation'), {
        transactionId: txid,
        confirmedRound: Number(round),
      })
    },
    async submitSigned(signedRecord) {
      const { txid } = await broadcastSigned(signedRecord)
      const confirmation = await algosdk.waitForConfirmation(context.algod, txid, 4)
      return buildConfirmationRecord(
        identity('payment-confirmation', { network: signedRecord.network }),
        { transactionId: txid, confirmedRound: Number(confirmation.confirmedRound) },
      )
    },
    lookupAccount: (address) => callTool('get_account_portfolio', { address }),
    lookupAccounts: (addresses) => callTool('batch_lookup_accounts', { addresses: [...addresses] }),
    lookupTransaction: (txid) => callTool('lookup_transaction', { txid }),
    lookupTransactionGroup: (groupId) => callTool('lookup_transaction_group', { groupId }),
    lookupAsset: (assetId) => callTool('lookup_asset', { assetId }),
    lookupApplication: (applicationId) => callTool('lookup_application', { applicationId }),
    lookupBlock: (round) => callTool('lookup_block', { round }),
    lookupAccountAssets: (address) => callTool('get_account_assets', { address }),
    lookupAccountAppStates: (address) => callTool('get_account_app_local_states', { address }),
    searchTransactions({ address, assetId, applicationId, round, txType, nextToken }) {
      const page = {
        limit: 20,
        ...(nextToken ? { nextToken } : {}),
        ...(txType ? { txType } : {}),
      }
      return address
        ? callTool('search_account_transactions', {
            ...page,
            address,
            ...(assetId === undefined ? {} : { assetId }),
          })
        : callTool('search_transactions', {
            ...page,
            ...(assetId === undefined ? {} : { assetId }),
            ...(applicationId === undefined ? {} : { applicationId }),
            ...(round === undefined ? {} : { minRound: round, maxRound: round }),
          })
    },
    callTool,
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
export { nfdRecordSchema, resolveNfdName, type NfdRecord } from './nfd.js'

export { createEnrichmentHost, type EnrichmentHost } from './enrich.js'
