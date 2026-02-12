/**
 * Wallet Transaction Signer
 *
 * Implements the algosdk TransactionSigner interface using WalletConnect v1.
 * Sends signing requests to the connected mobile wallet.
 *
 * Incorporates patterns from TxnLab's use-wallet for robustness.
 */

import algosdk, { type Transaction, type TransactionSigner } from 'algosdk'
import type { IConnector } from '@walletconnect/types'
import { SigningRejectedError, SigningTimeoutError, NoSessionError } from '../errors.js'
import { SIGNING_TIMEOUT_MS } from '../constants.js'
import type { WalletConnectTransaction } from '../types/index.js'

/**
 * Normalize signed transaction response from wallet.
 * Different wallets may return signed transactions in various formats.
 */
function normalizeSignedTxn(value: unknown): Uint8Array | null {
  if (value === null) return null
  if (typeof value === 'string') {
    // Base64 string (most common)
    return new Uint8Array(Buffer.from(value, 'base64'))
  }
  if (value instanceof Uint8Array) {
    return value
  }
  if (Array.isArray(value) && value.every((v) => typeof v === 'number')) {
    // Number array
    return new Uint8Array(value)
  }
  throw new Error(`Unexpected signed transaction format: ${typeof value}`)
}

/**
 * Check if a transaction is already signed.
 * Useful for defensive handling of edge cases.
 */
function isAlreadySigned(txnBytes: Uint8Array): boolean {
  try {
    const decoded = algosdk.msgpackRawDecode(txnBytes) as { sig?: unknown }
    return !!decoded.sig
  } catch {
    return false
  }
}

/**
 * Create a transaction signer that uses WalletConnect v1.
 *
 * The signer blocks until the user approves or rejects the transaction
 * in their mobile wallet.
 *
 * @param connector - WalletConnect v1 connector
 * @param connectedAddresses - Addresses of accounts connected via WalletConnect
 * @returns TransactionSigner function
 */
export function createWalletConnectSigner(
  connector: IConnector,
  connectedAddresses: string[]
): TransactionSigner {
  return async (txnGroup: Transaction[], indexesToSign: number[]): Promise<Uint8Array[]> => {
    if (!connector.connected) {
      throw new NoSessionError()
    }

    // Verify each transaction to sign has a sender we control
    for (const idx of indexesToSign) {
      const sender = algosdk.encodeAddress(txnGroup[idx].sender.publicKey)
      if (!connectedAddresses.includes(sender)) {
        throw new Error(
          `Cannot sign transaction ${idx}: sender ${sender} not in connected accounts`
        )
      }
    }

    // Build transaction array for WalletConnect
    const wcTxns: WalletConnectTransaction[] = txnGroup.map((txn, idx) => {
      // Get the raw transaction bytes and encode to base64
      const txnBytes = txn.toByte()
      const txnBase64 = Buffer.from(txnBytes).toString('base64')

      if (indexesToSign.includes(idx)) {
        // Transaction needs to be signed
        return { txn: txnBase64 }
      } else {
        // Transaction should not be signed (e.g., already signed or for different signer)
        return { txn: txnBase64, signers: [] }
      }
    })

    // Create signing request using sendCustomRequest for WalletConnect v1
    // Response format varies by wallet - could be base64 strings, Uint8Arrays, or number arrays
    const signedTxnsPromise = connector.sendCustomRequest({
      method: 'algo_signTxn',
      params: [wcTxns],
    }) as Promise<unknown[]>

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new SigningTimeoutError()), SIGNING_TIMEOUT_MS)
    })

    let signedTxns: unknown[]
    try {
      signedTxns = await Promise.race([signedTxnsPromise, timeoutPromise])
    } catch (error) {
      // Handle WalletConnect errors
      if (error instanceof SigningTimeoutError) {
        throw error
      }

      const errorMessage = error instanceof Error ? error.message : String(error)

      // Check for user rejection
      if (
        errorMessage.includes('rejected') ||
        errorMessage.includes('declined') ||
        errorMessage.includes('User rejected')
      ) {
        throw new SigningRejectedError()
      }

      throw error
    }

    // Extract signed transactions for the requested indexes
    const result: Uint8Array[] = []

    for (const idx of indexesToSign) {
      const signedTxn = normalizeSignedTxn(signedTxns[idx])
      if (!signedTxn) {
        throw new Error(`Transaction at index ${idx} was not signed by the wallet`)
      }
      // Verify the response actually contains a signature
      if (!isAlreadySigned(signedTxn)) {
        throw new Error(`Transaction at index ${idx} returned without a valid signature`)
      }
      result.push(signedTxn)
    }

    return result
  }
}
