/** Context lines a host prepends to a turn. */
/**
 * The wallet's active account as a default-sender line for the agent, or ''
 * when there is none. Resolves a keystore label when known.
 */
export function activeSenderLine(
  activeSender: string | undefined,
  addressBook: ReadonlyArray<{ address: string; name?: string }>,
): string {
  if (!activeSender) return ''
  const named = addressBook.find((entry) => entry.address === activeSender)
  const label = named?.name ? `${named.name} (${activeSender})` : activeSender
  return `Active account (default sender): ${label}. Use it as sender for writes unless the user names another.`
}

