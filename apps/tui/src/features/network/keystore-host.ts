/**
 * The TUI host: the live host plus keystore-daemon signing and its address
 * book. Key material never enters this process — the daemon signs raw bytes
 * over its local socket. `signDraft` is public here; the guarantee that it
 * runs only after a recorded approval lives in the flow controller
 * (`submitAction`), which is the only caller.
 */
import { createKeystoreSigner, type KeystoreSigner } from '@initlabs/vibekit/signer-keystore'
import type {
  EntityLookupHost,
  ActionHost,
  StructuredResult,
  TransactionSearchFilter,
} from '@initlabs/vibekit/views'
import {
  createLiveHost,
  signDraftWith,
  unsignedTransactionsForDraft,
  type LiveHost,
  type LiveNetworkId,
} from '@initlabs/vibekit/live'

/** The live host plus keystore signing (so it satisfies ActionHost) and the daemon's address book. */
export interface KeystorePaymentHost extends LiveHost, EntityLookupHost {
  /** Signs the approved draft group in the keystore daemon. */
  signDraft(draftRecord: StructuredResult): Promise<StructuredResult>
  /** The keystore daemon's address book (names never leave this process). */
  listSigningAccounts(): Promise<Array<{ address: string; name?: string }>>
  close(): Promise<void>
}

/**
 * Overlays keystore labels onto an account record's rows (account.list /
 * account.summary shapes). Copy-on-write; names never leave this process.
 */
export function withAccountNames(
  record: StructuredResult,
  book: ReadonlyArray<{ address: string; name?: string }>,
): StructuredResult {
  if (record.state !== 'success') return record
  const data = record.data as { accounts?: Array<{ address?: string; name?: string }> }
  if (!Array.isArray(data?.accounts)) return record
  const names = new Map(
    book.filter((entry) => entry.name).map((entry) => [entry.address, entry.name!]),
  )
  let changed = false
  const accounts = data.accounts.map((row) => {
    const name = row.address ? names.get(row.address) : undefined
    if (!name || row.name) return row
    changed = true
    return { ...row, name }
  })
  return changed ? { ...record, data: { ...data, accounts } } : record
}

/** Creates the TUI host over one named network and the local keystore daemon. */
export function createKeystorePaymentHost(
  network: LiveNetworkId = 'localnet',
): KeystorePaymentHost {
  const compose = createLiveHost(network)
  let signerPromise: Promise<KeystoreSigner> | undefined
  const signer = () => (signerPromise ??= createKeystoreSigner())

  return {
    ...compose,
    async listSigningAccounts() {
      const accounts = await (await signer()).listAccounts()
      return accounts.map(({ address, name }) => ({
        address,
        ...(name === undefined ? {} : { name }),
      }))
    },
    async signDraft(draftRecord: StructuredResult) {
      // The keystore signs for the drafted sender; a router's legs come pre-signed in the draft.
      const sender =
        (draftRecord.state === 'success'
          ? (draftRecord.data as { sender: string }).sender
          : undefined) ?? unsignedTransactionsForDraft(draftRecord)[0]!.sender.toString()
      const txnSigner = await (await signer()).resolveSigner(sender)
      return signDraftWith(
        {
          resultId: `result-live-payment-signed-${crypto.randomUUID()}`,
          toolCallId: `tool-call-live-payment-signed-${crypto.randomUUID()}`,
          network: draftRecord.network,
        },
        draftRecord,
        txnSigner,
      )
    },
    async close() {
      if (signerPromise) await (await signerPromise).close()
    },
  }
}
