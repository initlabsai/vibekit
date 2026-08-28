'use client'

/** Turns bought per address: the balance the composer shows, and the x402 purchase the wallet signs. */
import { useCallback, useEffect, useState } from 'react'

export interface Credits {
  paid: number
  freeLeft: number
}

export interface CreditsState {
  enabled: boolean
  price?: string
  chain?: 'mainnet' | 'testnet'
  network?: string
  turnsPerPack: number
  freeTurns: number
  credits?: Credits
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
    const response = await fetch(`/api/credits${activeAddress ? `?payer=${activeAddress}` : ''}`)
    if (!response.ok) throw new Error(`credits route failed (${response.status})`)
    const next = (await response.json()) as CreditsState
    setState(next)
    return next
  }, [activeAddress])

  useEffect(() => {
    void refresh().catch(() => undefined)
  }, [refresh])

  /** The route reports the balance after each turn; keep it without a round trip. */
  const setCredits = useCallback((credits: Credits) => setState((current) => ({ ...current, credits })), [])

  /** Pays for one pack through the connected wallet; resolves to the refreshed balance and the settled txid. */
  const buy = useCallback(async (): Promise<{ state: CreditsState; txid?: string }> => {
    if (!state.enabled || !state.network) throw new Error('Credits are not for sale here; the house pays.')
    if (!activeAddress) throw new Error('connect a wallet to pay')
    // The payment stack rides in only when someone buys; it is not part of the page.
    const [{ wrapFetchWithPayment, x402Client, decodePaymentResponseHeader }, { ExactAvmScheme }] = await Promise.all([import('@x402/fetch'), import('@x402/avm/exact/client')])
    const client = new x402Client().register(state.network as `${string}:${string}`, new ExactAvmScheme({ address: activeAddress, signTransactions }))
    const response = await wrapFetchWithPayment(fetch, client)('/api/credits', { method: 'POST' })
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error ?? `payment failed (${response.status})`)
    }
    const settled = response.headers.get('payment-response')
    let txid: string | undefined
    try {
      txid = settled ? decodePaymentResponseHeader(settled).transaction : undefined
    } catch {
      // The pack is paid either way; the receipt card is a courtesy.
    }
    return { state: await refresh(), txid }
  }, [activeAddress, refresh, signTransactions, state.enabled, state.network])

  return { ...state, refresh, buy, setCredits }
}
