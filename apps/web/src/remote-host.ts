/**
 * The browser's Explorer host: a fetch wrapper over `/api/explorer` that
 * implements every read plus the write flow. The network rides on every
 * request body. Signing is injected only when a wallet is connected; the
 * server verifies and broadcasts, and the browser polls for confirmation.
 */
import { z } from 'zod'
import {
  structuredResultSchema,
  type ExplorerReadHost,
  type LiveNetworkId,
  type PaymentDraftParams,
  type StructuredResult,
  type TransactionSearchFilter,
  type WriteFlowHost,
} from '@initlabs/vibekit-explorer'

const ROUTE = '/api/explorer'
const CONFIRMATION_POLL_MS = 1000
const CONFIRMATION_ATTEMPTS = 30

/** The nfd plugin's resolve_nfd record, as the browser validates it. */
export const nfdProfileSchema = z.object({
  name: z.string(),
  address: z.string().optional(),
  owner: z.string().optional(),
  appId: z.number().optional(),
  state: z.string().optional(),
  properties: z.record(z.string(), z.string()).optional(),
})
export type NfdProfile = z.infer<typeof nfdProfileSchema>

export type RemoteExplorerHost = ExplorerReadHost &
  WriteFlowHost & {
    network: LiveNetworkId
    probe(): Promise<boolean>
    statusRound(): Promise<{ lastRound: number }>
    /** `alice.algo` to its NFD profile; mainnet and testnet only. */
    resolveName(name: string): Promise<NfdProfile>
  }

async function post<T = { record?: unknown }>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = (await response.json()) as T & { error?: string }
  if (!response.ok) {
    throw new Error(payload.error ?? `Explorer route failed with status ${response.status}`)
  }
  return payload
}

/** The browser validates every record before trusting it into the store. */
async function postRecord(body: Record<string, unknown>): Promise<StructuredResult> {
  const payload = await post(body)
  return structuredResultSchema.parse(payload.record)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function createRemoteExplorerHost(args: {
  network: LiveNetworkId
  signDraft?: WriteFlowHost['signDraft']
}): RemoteExplorerHost {
  const { network, signDraft } = args
  /** The draft the wallet last signed; submit sends it back so the server can re-verify the bytes. */
  let signedDraft: StructuredResult | undefined
  const call = (action: string, fields: Record<string, unknown> = {}) =>
    postRecord({ action, network, ...fields })
  return {
    network,
    async probe() {
      try {
        const payload = await post<{ live?: boolean }>({ action: 'probe', network })
        return payload.live === true
      } catch {
        return false
      }
    },
    statusRound: () => post<{ lastRound: number }>({ action: 'status-round', network }),
    async resolveName(name) {
      const payload = await post<{ nfd?: unknown }>({ action: 'resolve-nfd', network, name })
      return nfdProfileSchema.parse(payload.nfd)
    },
    draftPayment: (params: PaymentDraftParams) => call('draft-payment', { params }),
    simulateDraft: (draftRecord) => call('simulate-draft', { draftRecord }),
    ...(signDraft
      ? {
          async signDraft(draftRecord) {
            const record = await signDraft(draftRecord)
            signedDraft = draftRecord
            return record
          },
        }
      : {}),
    async submitSigned(signedRecord) {
      if (signedRecord.state !== 'success') throw new Error('Cannot submit a failed signed record')
      if (!signedDraft) throw new Error('No draft was signed in this session')
      const { transactions } = signedRecord.data as { transactions: string[] }
      const { txid } = await post<{ txid: string }>({
        action: 'submit-signed',
        network,
        draftRecord: signedDraft,
        signedTransactions: transactions,
      })
      for (let attempt = 0; attempt < CONFIRMATION_ATTEMPTS; attempt++) {
        const payload = await post<{ record?: unknown; pending?: boolean }>({
          action: 'await-confirmation',
          network,
          txid,
        })
        if (payload.record !== undefined) return structuredResultSchema.parse(payload.record)
        await sleep(CONFIRMATION_POLL_MS)
      }
      throw new Error(`${txid} was broadcast but not confirmed within ${CONFIRMATION_ATTEMPTS}s`)
    },
    lookupAccount: (address) => call('lookup-account', { address }),
    lookupAccounts: (addresses) => call('lookup-accounts', { addresses: [...addresses] }),
    lookupAccountAssets: (address) => call('lookup-account-assets', { address }),
    lookupAccountAppStates: (address) => call('lookup-account-app-states', { address }),
    lookupTransaction: (txid) => call('lookup-transaction', { txid }),
    lookupTransactionGroup: (groupId) => call('lookup-transaction-group', { groupId }),
    lookupAsset: (assetId) => call('lookup-asset', { assetId }),
    lookupApplication: (applicationId) => call('lookup-application', { applicationId }),
    lookupBlock: (round) => call('lookup-block', { round }),
    searchTransactions: (filter: TransactionSearchFilter) =>
      call('search-transactions', { filter }),
    callTool: (toolName, toolArgs) => call('call-tool', { toolName, args: toolArgs }),
  }
}
