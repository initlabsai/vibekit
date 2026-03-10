export type ClassifiedInput =
  | { kind: 'address'; value: string }
  | { kind: 'transaction'; value: string }
  | { kind: 'group'; value: string }
  | { kind: 'nfd'; value: string }
  | { kind: 'integer'; value: string }
  | { kind: 'freetext'; value: string }

/** Classify a raw user input into a known Algorand type or freetext. */
export function classifyInput(raw: string): ClassifiedInput {
  const trimmed = raw.trim()

  if (/^[A-Z2-7]{58}$/.test(trimmed)) {
    return { kind: 'address', value: trimmed }
  }

  if (/^[A-Z2-7]{52}$/.test(trimmed)) {
    return { kind: 'transaction', value: trimmed }
  }

  if (/^[A-Za-z0-9+/]+=+$/.test(trimmed)) {
    return { kind: 'group', value: trimmed }
  }

  if (/^[\w.-]+\.algo$/i.test(trimmed)) {
    return { kind: 'nfd', value: trimmed }
  }

  if (/^\d+$/.test(trimmed)) {
    return { kind: 'integer', value: trimmed }
  }

  return { kind: 'freetext', value: trimmed }
}

export interface InputHint {
  calls: Array<{ tool: string; args: Record<string, unknown> }>
  /** When true, calls are speculative — errors are silently dropped. */
  tryAll?: boolean
}

/** Build direct tool calls for a classified input. Returns null for freetext. */
export function buildHint(input: ClassifiedInput): InputHint | null {
  switch (input.kind) {
    case 'address':
      return {
        calls: [
          { tool: 'lookup_account', args: { address: input.value } },
        ],
      }
    case 'transaction':
      return {
        calls: [{ tool: 'lookup_transaction', args: { txid: input.value } }],
      }
    case 'group':
      return {
        calls: [{ tool: 'lookup_transaction_group', args: { groupId: input.value } }],
      }
    case 'nfd':
      return {
        calls: [{ tool: 'resolve_nfd', args: { name: input.value } }],
      }
    case 'integer':
      return {
        tryAll: true,
        calls: [
          { tool: 'lookup_block', args: { round: parseInt(input.value, 10) } },
          { tool: 'lookup_asset', args: { assetId: parseInt(input.value, 10) } },
          { tool: 'lookup_application', args: { applicationId: parseInt(input.value, 10) } },
        ],
      }
    case 'freetext':
      return null
  }
}

