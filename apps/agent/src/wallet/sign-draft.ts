/**
 * The browser's half of signing: post the signed bytes to the server, which
 * verifies they wrap the drafted group before recording them. The browser
 * is not trusted to claim what it signed. Pairs with the explorer's
 * `createWalletSignDraft` as its `record` transport.
 */
import { structuredResultSchema, type StructuredResult } from '@initlabs/vibekit-explorer'

export async function recordSigned(
  network: string,
  draftRecord: StructuredResult,
  signedTransactions: string[],
): Promise<StructuredResult> {
  const response = await fetch('/api/explorer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'record-signed', network, draftRecord, signedTransactions }),
  })
  const payload = (await response.json()) as { record?: unknown; error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Signing was refused (${response.status})`)
  return structuredResultSchema.parse(payload.record)
}
