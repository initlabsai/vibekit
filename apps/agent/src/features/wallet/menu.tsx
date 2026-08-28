'use client'

/**
 * The wallet, as one control in the top bar: an avatar button (name beside it
 * where there is room) whose menu holds the identity, the accounts, the
 * account card, and disconnect — or Pera / Lute when nothing is connected.
 */
import type { Wallet } from '@txnlab/use-wallet-react'
import Link from 'next/link'
import { useContext } from 'react'

import { Avatar, Identity, OpenContext } from '../../primitives'
import { shorten } from '../../theme'
import { warmWallets, type WalletLane } from '../../wallet/provider'

/**
 * Connects one wallet and only one: any other connected wallet is disconnected
 * first, so signing never fans out to two. A stale Pera WalletConnect session
 * that refuses a second connect is dropped and retried.
 */
export async function connectWallet(wallet: Wallet, wallets: ReadonlyArray<Wallet> = []): Promise<void> {
  for (const other of wallets) {
    if (other.id !== wallet.id && other.isConnected) await other.disconnect().catch(() => undefined)
  }
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
  const openTarget = useContext(OpenContext)
  const address = lane.activeAddress
  return (
    <details className="menu" onToggle={(event) => event.currentTarget.open && warmWallets()}>
      <summary className="button" aria-label={address ? `wallet: ${lane.activeName ?? shorten(address, 12)}` : 'connect a wallet'}>
        {address ? <Avatar address={address} size={22} /> : <span className="menu-glyph" aria-hidden="true">◌</span>}
        <span className="menu-name">{address ? (lane.activeName ?? shorten(address, 10)) : 'connect'}</span>
      </summary>
      <ul>
        {active && address ? (
          <>
            <li className="menu-id"><Identity address={address} open={false} /></li>
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
            {openTarget ? <li><button type="button" onClick={() => openTarget({ kind: 'account', address })}>account ▸</button></li> : null}
            <li><Link href="/wallet">wallet page ▸</Link></li>
            <li><button type="button" className="menu-danger" onClick={() => run(() => active.disconnect())}>disconnect</button></li>
          </>
        ) : lane.isReady ? (
          lane.wallets.map((wallet) => (
            <li key={wallet.id}>
              <button type="button" onClick={() => run(() => connectWallet(wallet, lane.wallets))}>{wallet.metadata.name}</button>
            </li>
          ))
        ) : (
          <li className="muted">loading…</li>
        )}
      </ul>
    </details>
  )
}
