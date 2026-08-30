/**
 * An ActionHost over a deployment: draft through the tools in compose mode,
 * simulate the exact drafted bytes, broadcast bytes someone else signed,
 * report a confirmation. No custody by construction — the deployment has no
 * signer. Server-side (algod clients).
 */
import algosdk from 'algosdk'

import { base64ToBytes, executeToolCall, isAction, type ResolvedDeployment } from '../core/index.js'
import { decodeUnsignedGroup, draftRecordFromComposeWire } from './decode.js'
import { buildConfirmationRecord, buildSimulationRecord } from './host.js'
import type { ActionRouteHost } from './http.js'
import type { JsonValue, StructuredResult } from './records.js'
import { draftDataSchema, signedGroupDataSchema } from './reducer.js'

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

/** An ActionHost that can also broadcast and report a confirmation, plus `submitSigned` that does both. */
export interface DeploymentActionHost extends ActionRouteHost {
  submitSigned(signedRecord: StructuredResult): Promise<StructuredResult>
}

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

export function createActionHost(deployment: ResolvedDeployment, network = deployment.defaultNetwork): DeploymentActionHost {
  const context = deployment.contexts.get(network)
  if (!context) throw new Error(`Deployment is missing network ${network}`)
  const identity = (slug: string, extra?: { input?: JsonValue; network?: string }) => ({
    resultId: newId(`result-${slug}`),
    toolCallId: newId(`tool-call-${slug}`),
    network: extra?.network ?? network,
    ...(extra?.input === undefined ? {} : { input: extra.input }),
  })
  /** Broadcast only; confirmation is a separate poll so a caller need not hold a connection. */
  const broadcastSigned = async (signedRecord: StructuredResult): Promise<{ txid: string }> => {
    if (signedRecord.state !== 'success') throw new Error('Cannot submit a failed signed record')
    const signed = signedGroupDataSchema.parse(signedRecord.data)
    const { txid } = await context.algod.sendRawTransaction(signed.transactions.map(base64ToBytes)).do()
    return { txid }
  }
  return {
    network,
    async draft(toolName, args) {
      const tool = deployment.tools.find((candidate) => candidate.name === toolName)
      if (!tool) throw new Error(`This host has no tool named ${toolName}`)
      // Only actions draft; a query has no group to sign, and this is the trust boundary a route relies on.
      if (!isAction(tool)) throw new Error(`${toolName} is a query, not an action`)
      const wire = await executeToolCall(deployment, tool, args)
      return draftRecordFromComposeWire(identity('draft'), wire, toolName)
    },
    async simulateDraft(draftRecord) {
      if (draftRecord.state !== 'success') throw new Error('Cannot simulate a failed draft record')
      const draft = draftDataSchema.parse(draftRecord.data)
      // The group bytes, not reconstructed specs, are the simulated truth.
      const decoded = decodeUnsignedGroup(draft.unsignedGroup.transactions, draft.presigned)
      const wire = await simulateUnsignedGroup(context.algod, draft.unsignedGroup.transactions)
      return buildSimulationRecord(identity('simulation', { network: draftRecord.network }), wire, decoded)
    },
    broadcastSigned,
    async confirmation(txid) {
      const pending = await context.algod.pendingTransactionInformation(txid).do()
      if (pending.poolError) throw new Error(pending.poolError)
      const round = pending.confirmedRound
      if (round === undefined || Number(round) === 0) return undefined
      return buildConfirmationRecord(identity('confirmation'), { transactionId: txid, confirmedRound: Number(round) })
    },
    async submitSigned(signedRecord) {
      const { txid } = await broadcastSigned(signedRecord)
      const confirmation = await algosdk.waitForConfirmation(context.algod, txid, 4)
      return buildConfirmationRecord(identity('confirmation', { network: signedRecord.network }), { transactionId: txid, confirmedRound: Number(confirmation.confirmedRound) })
    },
  }
}
