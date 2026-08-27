/** True for an algod/indexer HTTP 404 — the SDK surfaces it only in the message. */
export function isNotFound(error: unknown): boolean {
  return error instanceof Error && error.message.includes('404')
}
