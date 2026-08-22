/**
 * ZeroSignal (TxnLab) — decentralized inference over an OpenAI-compatible
 * local proxy. Admission is the wallet's on-chain seal, not an API key:
 * the proxy discards the key field, so any non-empty value satisfies
 * SDK plumbing. Billing is per-message USDC on Algorand.
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** The endpoint assumed when the daemon has not written where it listens. */
export const ZEROSIGNAL_DEFAULT_BASE_URL = 'http://localhost:8080/v1'

/** Where zs-proxy records its live address (`listen`) on every start. */
export function zeroSignalDaemonPath(env: Record<string, string | undefined> = process.env): string {
  const base = env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(base, 'zerosignal', 'daemon.json')
}

/**
 * The running daemon's OpenAI-compatible endpoint. zs-proxy's default port
 * has moved between versions (8080 → 9376), so the file it writes on start
 * is authoritative; the constant is only the fallback when there is none.
 */
export function zeroSignalBaseUrl(
  env: Record<string, string | undefined> = process.env,
  read: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): string {
  try {
    const { listen } = JSON.parse(read(zeroSignalDaemonPath(env))) as { listen?: unknown }
    const match = typeof listen === 'string' ? /^(\S*):(\d{1,5})$/.exec(listen) : null
    if (!match) return ZEROSIGNAL_DEFAULT_BASE_URL
    const host = match[1] === '' || match[1] === '0.0.0.0' || match[1] === '::' ? '127.0.0.1' : match[1]
    return `http://${host}:${match[2]}/v1`
  } catch {
    return ZEROSIGNAL_DEFAULT_BASE_URL
  }
}

/** Shown when the daemon is unreachable; names the address that was tried. */
export function zeroSignalSetupHint(baseUrl: string = zeroSignalBaseUrl()): string {
  return (
    `zs-proxy is not running at ${baseUrl}. Install it, start it (zs-proxy proxy start), and fund ` +
    'the wallet (zs-proxy fund). Quickstart: https://txnlab.gitbook.io/zerosignal/using-the-proxy/quick-start'
  )
}

/** @deprecated Use zeroSignalSetupHint(); kept for the ./config subpath. */
export const ZEROSIGNAL_SETUP_HINT = zeroSignalSetupHint(ZEROSIGNAL_DEFAULT_BASE_URL)

function serverRoot(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, '')
}

/** True when the zs-proxy daemon answers its liveness probe. */
export async function probeZeroSignal(
  baseUrl: string = zeroSignalBaseUrl(),
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
  baseUrl: string = zeroSignalBaseUrl(),
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/models`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) {
    throw new Error(`ZeroSignal model catalog unavailable (${response.status}). ${zeroSignalSetupHint(baseUrl)}`)
  }
  const body = (await response.json()) as { data?: Array<{ id?: unknown }> }
  const ids = (body.data ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  return ids
}
