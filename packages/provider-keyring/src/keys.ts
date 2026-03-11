/**
 * Key Generation and Signing
 *
 * Handles Algorand key generation, mnemonic encoding, and transaction signing.
 */

import { Buffer } from 'buffer'
import algosdk from 'algosdk'
import type { Transaction, TransactionSigner } from 'algosdk'

/**
 * Generated key pair with mnemonic.
 */
export interface GeneratedKey {
  /** Algorand address */
  address: string
  /** 25-word mnemonic phrase */
  mnemonic: string
  /** Raw private key (64 bytes: 32-byte seed + 32-byte public key) */
  privateKey: Uint8Array
}

/**
 * Generate a new Algorand key pair.
 * Returns the address, mnemonic, and private key.
 */
export function generateKey(): GeneratedKey {
  const account = algosdk.generateAccount()
  const mnemonic = algosdk.secretKeyToMnemonic(account.sk)

  return {
    address: account.addr.toString(),
    mnemonic,
    privateKey: account.sk,
  }
}

/**
 * Recover a key from a mnemonic phrase.
 */
export function keyFromMnemonic(mnemonic: string): GeneratedKey {
  const privateKey = algosdk.mnemonicToSecretKey(mnemonic)

  return {
    address: privateKey.addr.toString(),
    mnemonic,
    privateKey: privateKey.sk,
  }
}

/**
 * Get address from a private key.
 */
export function addressFromPrivateKey(privateKey: Uint8Array): string {
  // The public key is the last 32 bytes of the 64-byte private key
  const publicKey = privateKey.slice(32)
  return algosdk.encodeAddress(publicKey)
}

/**
 * Create a transaction signer from a private key.
 */
export function createSigner(privateKey: Uint8Array): TransactionSigner {
  return async (txnGroup: Transaction[], indexesToSign: number[]): Promise<Uint8Array[]> => {
    const signedTxns: Uint8Array[] = []

    for (const idx of indexesToSign) {
      const txn = txnGroup[idx]
      const signedTxn = txn.signTxn(privateKey)
      signedTxns.push(signedTxn)
    }

    return signedTxns
  }
}

/**
 * Encode a private key to base64 for storage.
 */
export function encodePrivateKey(privateKey: Uint8Array): string {
  return Buffer.from(privateKey).toString('base64')
}

/**
 * Decode a private key from base64.
 */
export function decodePrivateKey(encoded: string): Uint8Array {
  return new Uint8Array(Buffer.from(encoded, 'base64'))
}
