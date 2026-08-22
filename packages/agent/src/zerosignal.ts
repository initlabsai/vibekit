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

/** What the operator catalog says about one model id. */
export interface ZeroSignalModelInfo {
  /** USD per 1M tokens; absent when no operator advertises a price. */
  inputUsdPer1M?: number
  outputUsdPer1M?: number
  /** False for image-only models, which cannot drive the Explorer. */
  text: boolean
  toolUse: boolean
}

/**
 * The proxy's cached operator catalog (refreshed by zs-proxy itself), keyed
 * by model id. A model served by several operators keeps the lowest price.
 * Empty when the file is absent, so callers degrade to the bare id list.
 */
export function readZeroSignalCatalog(
  env: Record<string, string | undefined> = process.env,
  read: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): Map<string, ZeroSignalModelInfo> {
  const catalog = new Map<string, ZeroSignalModelInfo>()
  try {
    const path = join(zeroSignalDaemonPath(env), '..', 'operator-catalog.json')
    const parsed = JSON.parse(read(path)) as {
      operators?: Array<{ model_capacities?: Record<string, Record<string, unknown>> }>
    }
    for (const operator of parsed.operators ?? []) {
      for (const [id, cap] of Object.entries(operator.model_capacities ?? {})) {
        const outputs = cap.OutputModalities
        const text = !Array.isArray(outputs) || outputs.includes('text')
        const price = (value: unknown) => (typeof value === 'number' && value > 0 ? value : undefined)
        const next: ZeroSignalModelInfo = {
          inputUsdPer1M: price(cap.InputUSDPer1M),
          outputUsdPer1M: price(cap.OutputUSDPer1M),
          text,
          toolUse: cap.ToolUse === true,
        }
        const prev = catalog.get(id)
        const cheaper =
          !prev ||
          (next.outputUsdPer1M ?? Infinity) + (next.inputUsdPer1M ?? Infinity) <
            (prev.outputUsdPer1M ?? Infinity) + (prev.inputUsdPer1M ?? Infinity)
        if (cheaper) catalog.set(id, next)
      }
    }
  } catch {
    // No catalog yet (fresh install) — the id list still works.
  }
  return catalog
}

/** `$0.10 / $0.24 per 1M`, `no price listed` (0 in the catalog), or undefined when the catalog has no price. */
export function formatZeroSignalPrice(info: ZeroSignalModelInfo | undefined): string | undefined {
  if (!info) return undefined
  if (info.inputUsdPer1M === undefined && info.outputUsdPer1M === undefined) return 'no price listed'
  const usd = (value: number | undefined) => (value === undefined ? '—' : `$${value.toFixed(value < 1 ? 3 : 2)}`)
  return `${usd(info.inputUsdPer1M)} / ${usd(info.outputUsdPer1M)} per 1M`
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
