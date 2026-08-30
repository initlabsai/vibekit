/**
 * The browser's half of signing: post the signed bytes to the server, which
 * verifies they wrap the drafted group before recording them. Pairs with the
 * package's `createWalletSignDraft` as its `record` transport.
 */
import { createRemoteActionHost } from '@initlabs/vibekit/actions'
import type { StructuredResult } from '@initlabs/vibekit/views'

export function recordSigned(network: string, draftRecord: StructuredResult, signedTransactions: string[]): Promise<StructuredResult> {
  return createRemoteActionHost({ url: '/api/explorer', network }).recordSigned(draftRecord, signedTransactions)
}
