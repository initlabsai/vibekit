/**
 * The browser's host: the package's read host over `POST /api/explorer/<tool>`
 * (a tool's output, wrapped into its view's record here), the package's
 * remote action host over `POST /api/explorer`, and the liveness probe. The
 * network rides on every request. Signing is injected only when a wallet is
 * connected; the server verifies and broadcasts, and the browser polls.
 */
import { createRemoteActionHost, type ActionHost, type RemoteActionHost } from '@initlabs/vibekit/actions'
import { createReadHost, recordForToolCall, type ReadHost, type LiveNetworkId } from '@initlabs/vibekit/views'
import { type StructuredResult } from '@initlabs/vibekit/actions'

const ROUTE = '/api/explorer'

export type RemoteExplorerHost = ReadHost &
  RemoteActionHost & {
    network: LiveNetworkId
    probe(): Promise<boolean>
    statusRound(): Promise<{ lastRound: number }>
    /** Any tool's raw output — plugin reads a card enriches itself with; the caller builds the record. */
    pluginTool(toolName: string, args: Record<string, unknown>): Promise<unknown>
    /** `alice.algo` to its NFD record wire; mainnet and testnet only. */
    resolveName(name: string): Promise<unknown>
  }

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const payload = (await response.json()) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Explorer route failed with status ${response.status}`)
  return payload
}

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

export function createRemoteExplorerHost(args: { network: LiveNetworkId; signDraft?: ActionHost['signDraft'] }): RemoteExplorerHost {
  const { network } = args
  /** A tool's raw output. `network` is the deployment's injected parameter. */
  const raw = (toolName: string, toolArgs: Record<string, unknown>) =>
    postJson<{ result: unknown; view?: string }>(`${ROUTE}/${toolName}`, { network, ...toolArgs })
  /** A tool's output as the record its view selects; `input` is kept so a list can page itself. */
  const callTool = async (toolName: string, toolArgs: Record<string, unknown>): Promise<StructuredResult> => {
    const id = newId('tool-call')
    const { result, view } = await raw(toolName, toolArgs)
    return recordForToolCall({ resultId: newId('result'), toolCallId: id, network, input: toolArgs as never }, toolName, result, view)
  }
  const actions = createRemoteActionHost({ url: ROUTE, network, ...(args.signDraft ? { signDraft: args.signDraft } : {}) })
  return {
    ...createReadHost(callTool),
    ...actions,
    network,
    async probe() {
      try {
        const response = await fetch(`${ROUTE}?network=${network}`)
        return response.ok && ((await response.json()) as { live?: boolean }).live === true
      } catch {
        return false
      }
    },
    async statusRound() {
      const response = await fetch(`${ROUTE}?network=${network}`)
      const payload = (await response.json()) as { round?: number; error?: string }
      if (!response.ok || payload.round === undefined) throw new Error(payload.error ?? `${network} is not reachable`)
      return { lastRound: payload.round }
    },
    pluginTool: async (toolName, toolArgs) => (await raw(toolName, toolArgs)).result,
    resolveName: async (name) => (await raw('resolve_nfd', { name })).result,
  }
}
