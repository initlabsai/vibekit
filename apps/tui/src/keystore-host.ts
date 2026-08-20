/**
 * The TUI's custody adapter: the shared compose-only host plus keystore-daemon
 * signing. Key material never enters this process — the daemon signs raw
 * bytes over its local socket (the §6 trust boundary). Signing is reachable
 * only through the flow controller, which requires a recorded approved
 * decision before it will invoke `signDraft`.
 */
import { createKeystoreSigner, type KeystoreSigner } from '@initlabs/vibekit-signer-keystore'
import type {
  EntityLookupHost,
  PaymentFlowHost,
  StructuredResult,
} from '@initlabs/vibekit-experience'
import {
  createPaymentComposeHost,
  signedGroupRecordFor,
  unsignedTransactionsForDraft,
  type LiveNetworkId,
} from '@initlabs/vibekit-experience/live'

/** The TUI payment host: compose, simulate, submit, and keystore signing. */
export interface KeystorePaymentHost extends PaymentFlowHost, EntityLookupHost {
  probe(timeoutMs?: number): Promise<boolean>
  /** True when the daemon is reachable and holds a key for the address. */
  canSign(address: string): Promise<boolean>
  /** Looks an account's portfolio up as an authoritative record. */
  lookupAccount(address: string): Promise<StructuredResult>
  /** Looks several accounts up as one account.list record. */
  lookupAccounts(addresses: readonly string[]): Promise<StructuredResult>
  /** Looks a transaction up as an authoritative record. */
  lookupTransaction(txid: string): Promise<StructuredResult>
  /** Looks every transaction in an atomic group up as one transaction.group record. */
  lookupTransactionGroup(groupId: string): Promise<StructuredResult>
  lookupAccountAssets(address: string): Promise<StructuredResult>
  lookupAccountAppStates(address: string): Promise<StructuredResult>
  lookupAccountTransactions(address: string): Promise<StructuredResult>
  /** The keystore daemon's address book (names never leave this process). */
  listSigningAccounts(): Promise<Array<{ address: string; name?: string }>>
  close(): Promise<void>
}

/** Creates the TUI host over one named network and the local keystore daemon. */
export function createKeystorePaymentHost(
  network: LiveNetworkId = 'localnet',
): KeystorePaymentHost {
  const compose = createPaymentComposeHost(network)
  let signerPromise: Promise<KeystoreSigner> | undefined
  const signer = () => (signerPromise ??= createKeystoreSigner())

  return {
    ...compose,
    async canSign(address) {
      try {
        return (await (await signer()).listAddresses()).includes(address)
      } catch {
        return false
      }
    },
    async listSigningAccounts() {
      const accounts = await (await signer()).listAccounts()
      return accounts.map(({ address, name }) => ({
        address,
        ...(name === undefined ? {} : { name }),
      }))
    },
    async signDraft(draftRecord: StructuredResult) {
      const transactions = unsignedTransactionsForDraft(draftRecord)
      const sender = transactions[0]!.sender.toString()
      const txnSigner = await (await signer()).resolveSigner(sender)
      const signed = await txnSigner(
        transactions,
        transactions.map((_, index) => index),
      )
      return signedGroupRecordFor(
        {
          resultId: `result-live-payment-signed-${crypto.randomUUID()}`,
          toolCallId: `tool-call-live-payment-signed-${crypto.randomUUID()}`,
          network: draftRecord.network,
        },
        draftRecord,
        signed,
      )
    },
    async close() {
      if (signerPromise) await (await signerPromise).close()
    },
  }
}
