/**
 * TestNet dispenser over the Foundation's authenticated faucet API, built to
 * the §6 secrets policy: the OAuth token lives in the keystore daemon's
 * secrets store (sealed like key material), agents wield `fund_testnet_account`
 * (token consumed in-handler, never returned), and the token *enters* via the
 * human-run `vibekit dispenser login` device flow.
 *
 * Unlike v1 (which requested no offline_access and died on expiry), the device
 * flow asks for a refresh token and the handler refreshes transparently;
 * DISPENSER_TOKEN_EXPIRED is only thrown when re-login is genuinely required.
 */

import { z } from 'zod'
import { defineTool, ToolError } from '@initlabs/vibekit-core'

// Same Auth0 tenant + API the AlgoKit dispenser uses.
const AUTH0_DOMAIN = 'dispenser-prod.eu.auth0.com'
const AUTH0_CLIENT_ID = 'BOZkxGUiiWkaAXZebCQ20MTIYuQSqqpI'
const AUTH0_AUDIENCE = 'api-prod-dispenser-ci'
const AUTH0_SCOPE = 'openid profile email offline_access'
const DISPENSER_API_URL = 'https://api.dispenser.algorandfoundation.tools'

export const DISPENSER_SECRET_ID = 'vibekit.dispenser.testnet'

const DEFAULT_FUND_MICROALGOS = 1_000_000 // 1 ALGO; daily limits apply upstream

export type FetchLike = typeof fetch

/** The slice of the daemon's SecretStoreAPI we use. */
export interface SecretsLike {
  put(value: Uint8Array | string, options?: { id?: string; name?: string }): Promise<string>
  get(id: string): Promise<Uint8Array>
  list(): Promise<Array<{ id: string }>>
  remove(id: string): Promise<void>
}

export interface DispenserToken {
  accessToken: string
  refreshToken?: string
  /** Epoch ms after which accessToken must be refreshed. */
  expiresAt: number
}

// --- Device flow (consumed by `vibekit dispenser login`) ---

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval: number
}

export async function requestDeviceCode(fetchFn: FetchLike = fetch): Promise<DeviceCodeResponse> {
  const response = await fetchFn(`https://${AUTH0_DOMAIN}/oauth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: AUTH0_CLIENT_ID,
      audience: AUTH0_AUDIENCE,
      scope: AUTH0_SCOPE,
    }),
  })
  if (!response.ok) {
    throw new Error(`Failed to request device code: ${response.status} ${await response.text()}`)
  }
  return (await response.json()) as DeviceCodeResponse
}

interface Auth0TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

function toToken(data: Auth0TokenResponse): DispenserToken {
  return {
    accessToken: data.access_token,
    ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
    // refresh a minute early to avoid using a token at the edge of expiry
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }
}

/** Poll the token endpoint until the user completes the browser step. */
export async function pollForToken(
  device: Pick<DeviceCodeResponse, 'device_code' | 'interval' | 'expires_in'>,
  fetchFn: FetchLike = fetch,
): Promise<DispenserToken> {
  const deadline = Date.now() + device.expires_in * 1000
  let interval = device.interval

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000))

    const response = await fetchFn(`https://${AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: AUTH0_CLIENT_ID,
        device_code: device.device_code,
        audience: AUTH0_AUDIENCE,
      }),
    })

    if (response.ok) {
      return toToken((await response.json()) as Auth0TokenResponse)
    }

    const error = (await response.json()) as { error?: string; error_description?: string }
    if (error.error === 'authorization_pending') continue
    if (error.error === 'slow_down') {
      interval += 1
      continue
    }
    if (error.error === 'expired_token') throw new Error('Authentication timed out. Please try again.')
    if (error.error === 'access_denied') throw new Error('Authentication was denied.')
    throw new Error(error.error_description || error.error || 'Authentication failed')
  }
  throw new Error('Authentication timed out. Please try again.')
}

async function refreshToken(refresh: string, fetchFn: FetchLike): Promise<DispenserToken> {
  const response = await fetchFn(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: AUTH0_CLIENT_ID,
      refresh_token: refresh,
    }),
  })
  if (!response.ok) {
    throw new ToolError(
      'DISPENSER_TOKEN_EXPIRED',
      'The TestNet dispenser session could not be refreshed — run `vibekit dispenser login`.',
    )
  }
  const data = (await response.json()) as Auth0TokenResponse
  // Auth0 may not rotate the refresh token; keep the old one if absent.
  return { ...toToken(data), refreshToken: data.refresh_token ?? refresh }
}

// --- Token custody (daemon secrets) ---

export async function saveDispenserToken(secrets: SecretsLike, token: DispenserToken): Promise<void> {
  // remove-then-put: put with an existing id is an error in the keystore
  await secrets.remove(DISPENSER_SECRET_ID).catch(() => {})
  await secrets.put(JSON.stringify(token), {
    id: DISPENSER_SECRET_ID,
    name: 'VibeKit TestNet dispenser token',
  })
}

export async function loadDispenserToken(secrets: SecretsLike): Promise<DispenserToken | null> {
  try {
    const bytes = await secrets.get(DISPENSER_SECRET_ID)
    return JSON.parse(new TextDecoder().decode(bytes)) as DispenserToken
  } catch {
    return null
  }
}

export async function hasDispenserToken(secrets: SecretsLike): Promise<boolean> {
  try {
    const entries = await secrets.list()
    return entries.some((entry) => entry.id === DISPENSER_SECRET_ID)
  } catch {
    return false
  }
}

/** Valid access token, transparently refreshed (and re-sealed) when stale. */
export async function getValidAccessToken(secrets: SecretsLike, fetchFn: FetchLike = fetch): Promise<string> {
  const token = await loadDispenserToken(secrets)
  if (!token) {
    throw new ToolError(
      'DISPENSER_NOT_CONFIGURED',
      'No TestNet dispenser session — run `vibekit dispenser login` once.',
    )
  }
  if (Date.now() < token.expiresAt) return token.accessToken
  if (!token.refreshToken) {
    throw new ToolError(
      'DISPENSER_TOKEN_EXPIRED',
      'The TestNet dispenser session expired — run `vibekit dispenser login`.',
    )
  }
  const fresh = await refreshToken(token.refreshToken, fetchFn)
  await saveDispenserToken(secrets, fresh)
  return fresh.accessToken
}

// --- The agent-facing capability ---

export function createFundTestnetTool(secrets: SecretsLike, fetchFn: FetchLike = fetch) {
  return defineTool({
    name: 'fund_testnet_account',
    description:
      'Fund an account with TestNet ALGO from the Algorand Foundation dispenser (authenticated; daily limits apply). Requires a one-time `vibekit dispenser login`. TestNet only — for localnet use the kmd dispenser, and mainnet funds are the user’s business.',
    parameters: z.object({
      receiver: z.string().describe('Address to fund on testnet'),
      amountMicroAlgos: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(`Amount in microALGO (default ${DEFAULT_FUND_MICROALGOS} = 1 ALGO)`),
    }),
    output: z.object({
      txId: z.string(),
      receiver: z.string(),
      amountMicroAlgos: z.number(),
    }),
    display: 'txn',
    requiresSigner: true, // a world-changing action — hosts gate it like other writes
    handler: async (_ctx, args) => {
      const amount = args.amountMicroAlgos ?? DEFAULT_FUND_MICROALGOS

      const attempt = async (accessToken: string) =>
        fetchFn(`${DISPENSER_API_URL}/fund/0`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiver: args.receiver, amount, assetID: 0 }),
          signal: AbortSignal.timeout(15_000),
        })

      let response = await attempt(await getValidAccessToken(secrets, fetchFn))

      if (response.status === 401) {
        // access token rejected despite local expiry math — force a refresh
        const token = await loadDispenserToken(secrets)
        if (token?.refreshToken) {
          const fresh = await refreshToken(token.refreshToken, fetchFn)
          await saveDispenserToken(secrets, fresh)
          response = await attempt(fresh.accessToken)
        }
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string }
        if (response.status === 401) {
          throw new ToolError(
            'DISPENSER_TOKEN_EXPIRED',
            'The TestNet dispenser session expired — run `vibekit dispenser login`.',
          )
        }
        if (response.status === 429 || body.code === 'fund_limit_exceeded') {
          throw new ToolError(
            'DISPENSER_LIMIT',
            body.message ?? 'Daily dispenser limit reached — try again tomorrow or use the treasury pattern.',
          )
        }
        throw new ToolError('DISPENSER_ERROR', body.message ?? `Dispenser request failed (${response.status})`)
      }

      const result = (await response.json()) as { txID: string; amount: number }
      return { txId: result.txID, receiver: args.receiver, amountMicroAlgos: result.amount }
    },
  })
}
