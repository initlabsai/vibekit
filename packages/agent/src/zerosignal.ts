/**
 * ZeroSignal (TxnLab) — decentralized inference over an OpenAI-compatible
 * local proxy. Admission is the wallet's on-chain seal, not an API key:
 * the proxy discards the key field, so any non-empty value satisfies
 * SDK plumbing. Billing is per-message USDC on Algorand.
 */

/** The zs-proxy daemon's default OpenAI-compatible endpoint. */
export const ZEROSIGNAL_DEFAULT_BASE_URL = 'http://localhost:8080/v1'

/** Shown when the daemon is unreachable. */
export const ZEROSIGNAL_SETUP_HINT =
  'zs-proxy is not running. Install it (brew install txnlab/tap/zs-proxy), start it ' +
  '(zs-proxy proxy start), and fund the wallet (zs-proxy fund). Docs: https://txnlab.gitbook.io/zerosignal'

function serverRoot(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, '')
}

/** True when the zs-proxy daemon answers its liveness probe. */
export async function probeZeroSignal(
  baseUrl: string = ZEROSIGNAL_DEFAULT_BASE_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetchImpl(`${serverRoot(baseUrl)}/healthz`, {
      signal: AbortSignal.timeout(2000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Live model catalog from the operator network. ZeroSignal has no default
 * model — requests must name a concrete id from this list.
 */
export async function listZeroSignalModels(
  baseUrl: string = ZEROSIGNAL_DEFAULT_BASE_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/models`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) {
    throw new Error(`ZeroSignal model catalog unavailable (${response.status}). ${ZEROSIGNAL_SETUP_HINT}`)
  }
  const body = (await response.json()) as { data?: Array<{ id?: unknown }> }
  const ids = (body.data ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  return ids
}
