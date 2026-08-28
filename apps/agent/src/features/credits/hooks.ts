'use client'

/**
 * Turns: the balance the composer shows and the x402 purchase the wallet
 * signs. Paying mints this browser's bearer token — a secret it makes itself
 * and sends with the payment — and the token is what reaches paid turns.
 */
import { useCallback, useEffect, useState } from 'react'

const TOKEN_KEY = 'vibekit.credits.token'

export interface CreditsState {
  enabled: boolean
  price?: string
  chain?: 'mainnet' | 'testnet'
  network?: string
  turnsPerPack: number
  pricePerTurnMicroUsdc?: number
  freeTurns: number
  /** Today's free turns left for this connection. */
  freeLeft?: number
  /** The address the bearer token names, and its paid turns. */
  payer?: string
  paid?: number
}

export function readCreditsToken(): string | undefined {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? undefined
  } catch {
    return undefined
  }
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** `Authorization` for the routes that spend turns; empty without a token. */
export function creditsHeaders(): Record<string, string> {
  const token = readCreditsToken()
  return token ? { authorization: `Bearer ${token}` } : {}
}

export function useCredits({
  activeAddress,
  signTransactions,
}: {
  activeAddress: string | undefined
  signTransactions: (txns: Uint8Array[], indexes?: number[]) => Promise<(Uint8Array | null)[]>
}) {
  const [state, setState] = useState<CreditsState>({ enabled: false, turnsPerPack: 0, freeTurns: 0 })

  const refresh = useCallback(async (): Promise<CreditsState> => {
    const response = await fetch('/api/credits', { headers: creditsHeaders() })
    if (!response.ok) throw new Error(`credits route failed (${response.status})`)
    const next = (await response.json()) as CreditsState
    setState(next)
    return next
  }, [])

  useEffect(() => {
    void refresh().catch(() => undefined)
  }, [refresh])

  /** The agent route reports what it charged; keep it without a round trip. */
  const setCredits = useCallback(
    (credits: { paid?: number; freeLeft?: number }) => setState((current) => ({ ...current, ...credits })),
    [],
  )

  /** Pays for `turns` (the pack size by default) through the connected wallet; resolves to the refreshed balance and the settled txid. */
  const buy = useCallback(async (turns?: number): Promise<{ state: CreditsState; txid?: string }> => {
    if (!state.enabled || !state.network) throw new Error('Credits are not for sale here; the house pays.')
    if (!activeAddress) throw new Error('connect a wallet to pay')
    // The payment stack rides in only when someone buys; it is not part of the page.
    const [{ wrapFetchWithPayment, x402Client, decodePaymentResponseHeader }, { ExactAvmScheme }] = await Promise.all([import('@x402/fetch'), import('@x402/avm/exact/client')])
    const client = new x402Client().register(state.network as `${string}:${string}`, new ExactAvmScheme({ address: activeAddress, signTransactions }))
    // A fresh secret travels with the payment; the server binds it to the payer once settled.
    const token = newToken()
    const response = await wrapFetchWithPayment(fetch, client)(`/api/credits${turns ? `?turns=${turns}` : ''}`, { method: 'POST', headers: { 'x-credit-token': token } })
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error ?? `payment failed (${response.status})`)
    }
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      // Private mode: the pack is paid; the turns last until this tab closes.
    }
    const settled = response.headers.get('payment-response')
    let txid: string | undefined
    try {
      txid = settled ? decodePaymentResponseHeader(settled).transaction : undefined
    } catch {
      // The pack is paid either way; the receipt line is a courtesy.
    }
    return { state: await refresh(), txid }
  }, [activeAddress, refresh, signTransactions, state.enabled, state.network])

  return { ...state, refresh, buy, setCredits }
}
