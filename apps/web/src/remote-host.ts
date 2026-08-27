import {
  structuredResultSchema,
  type AccountLookupHost,
  type PaymentDraftParams,
  type PaymentFlowHost,
  type StructuredResult,
} from '@initlabs/vibekit-explorer'

async function postFlowAction(body: unknown): Promise<StructuredResult> {
  const response = await fetch('/api/flow', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = (await response.json()) as { record?: unknown; error?: string }
  if (!response.ok) {
    throw new Error(payload.error ?? `Flow route failed with status ${response.status}`)
  }
  // The browser validates every record before trusting it into the store.
  return structuredResultSchema.parse(payload.record)
}

/**
 * The browser's PaymentFlowHost: a fetch wrapper over the app's signerless
 * compose-only server route. Chain access and group decoding stay
 * server-side; the browser only handles validated protocol records.
 */
export function createRemoteFlowHost(network = 'localnet'): PaymentFlowHost & AccountLookupHost {
  return {
    network,
    draftPayment: (params: PaymentDraftParams) => postFlowAction({ action: 'draft', params }),
    simulateDraft: (draftRecord: StructuredResult) =>
      postFlowAction({ action: 'simulate', draftRecord }),
    lookupAccount: (address: string) => postFlowAction({ action: 'lookup-account', address }),
    lookupAccounts: (addresses: readonly string[]) =>
      postFlowAction({ action: 'lookup-accounts', addresses: [...addresses] }),
    lookupAccountAssets: async () => {
      throw new Error('Account lists are not available in the web app')
    },
    lookupAccountAppStates: async () => {
      throw new Error('Account shelves are TUI-only in this slice')
    },
    searchTransactions: async () => {
      throw new Error('Transaction search is not available in the web app')
    },
    callTool: async () => {
      throw new Error('Paging is not available in the web app')
    },
  }
}

/** Probes the server route; false when localnet or the route is unreachable. */
export async function probeRemoteFlowHost(): Promise<boolean> {
  try {
    const response = await fetch('/api/flow', { method: 'GET' })
    if (!response.ok) return false
    const payload = (await response.json()) as { live?: boolean }
    return payload.live === true
  } catch {
    return false
  }
}
