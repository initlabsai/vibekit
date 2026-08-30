/**
 * An action end to end, no UI: draft a payment on LocalNet, walk it to
 * approval, sign with the keystore daemon, submit. Every stage is a record.
 * Swap `send_payment` for any action tool; swap the keystore for any
 * algosdk TransactionSigner (see packages/vibekit/examples/signer.ts).
 *
 * Run from the repo root with LocalNet and `keystore serve` up:
 *   SENDER=<address in the keystore> RECEIVER=<address> bun packages/explorer/examples/action.ts
 */
import { createKeystoreSigner } from '@initlabs/vibekit/signer-keystore'
import { createResultStore, performActionStep, startAction, submitAction } from '@initlabs/vibekit/actions'
import { createLiveHost, signDraftWith } from '@initlabs/vibekit-explorer/live'

const sender = process.env.SENDER!
const receiver = process.env.RECEIVER ?? sender
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

// The live host composes and submits but cannot sign; signing is the one capability we add.
const live = createLiveHost('localnet')
const keystore = await createKeystoreSigner()
const host = {
  ...live,
  signDraft: async (draftRecord: Parameters<typeof signDraftWith>[1]) =>
    signDraftWith(
      { resultId: newId('result-signed'), toolCallId: newId('tool-call-signed'), network: 'localnet' },
      draftRecord,
      await keystore.resolveSigner(sender),
    ),
}

// draft → simulate → inspect → awaiting-approval
const prepared = await startAction({
  host,
  store: createResultStore(),
  draft: { toolName: 'send_payment', args: { sender, receiver, amountMicroAlgos: 250_000, note: 'vibekit action example' } },
  newId,
  onStep: (_store, flow) => console.log(flow.stage),
})
if (!prepared.ok || !prepared.flow) throw new Error(prepared.message)

// The one step that needs a human. Here: you, reading this line.
const approved = await performActionStep({ host, store: prepared.store, flow: prepared.flow, kind: 'approve', newId })
if (!approved.ok) throw new Error(approved.message)

// sign → confirm
const done = await submitAction({ host, store: approved.store, flow: approved.flow, newId, onStep: (_s, flow) => console.log(flow.stage) })
await keystore.close()
if (!done.ok) throw new Error(done.message)
console.log(done.flow?.confirmation)
