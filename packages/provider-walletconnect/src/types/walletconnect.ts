/**
 * WalletConnect Types
 *
 * Types specific to WalletConnect protocol.
 */

/**
 * Pera config response structure.
 */
export interface PeraConfig {
  servers: string[]
}

/**
 * Transaction to sign via WalletConnect.
 */
export interface WalletConnectTransaction {
  /** Base64-encoded unsigned transaction */
  txn: string
  /** Optional message to display in wallet */
  message?: string
  /** Optional list of signers (empty array means don't sign) */
  signers?: string[]
}
