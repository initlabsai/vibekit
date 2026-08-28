'use client'

/** The top-bar wallet menu: Pera or Lute to connect; accounts and disconnect once connected. */
import type { Wallet } from '@txnlab/use-wallet-react'
import Link from 'next/link'

import { shorten } from '../../theme'
import { warmWallets, type WalletLane } from '../../wallet/provider'

/** Connects, dropping a stale Pera WalletConnect session that refuses a second connect. */
export async function connectWallet(wallet: Wallet): Promise<void> {
  try {
    await wallet.connect()
  } catch (caught) {
    if (!/session currently connected/i.test(String(caught))) throw caught
    await wallet.disconnect().catch(() => undefined)
    await wallet.connect()
  }
}

export function WalletMenu({ lane, onError }: { lane: WalletLane; onError: (message: string) => void }) {
  const run = (task: () => Promise<unknown>) => {
    void task().catch((caught: unknown) => onError(caught instanceof Error ? caught.message : String(caught)))
  }
  const active = lane.activeWallet
  return (
    <details className="menu" onToggle={(event) => event.currentTarget.open && warmWallets()}>
      <summary className="button">{lane.activeAddress ? `▸ ${lane.activeName ?? shorten(lane.activeAddress, 12)}` : '▸ no wallet'}</summary>
      <ul>
        {active ? (
          <>
            {lane.accounts.map((account) => (
              <li key={account.address}>
                <button
                  type="button"
                  className={account.address === lane.activeAddress ? 'on' : undefined}
                  onClick={() => active.setActiveAccount(account.address)}
                >
                  {account.name ?? shorten(account.address, 12)}
                </button>
              </li>
            ))}
            <li><Link href="/wallet">wallet ▸</Link></li>
            <li><button type="button" onClick={() => run(() => active.disconnect())}>disconnect</button></li>
          </>
        ) : lane.isReady ? (
          lane.wallets.map((wallet) => (
            <li key={wallet.id}>
              <button type="button" onClick={() => run(() => connectWallet(wallet))}>{wallet.metadata.name}</button>
            </li>
          ))
        ) : (
          <li className="muted">loading…</li>
        )}
      </ul>
    </details>
  )
}
