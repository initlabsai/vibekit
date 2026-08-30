'use client'

/** The wallet screen: a branded connect menu over `useWallet().wallets`, and the connected accounts. */
import type { LiveNetworkId } from '@initlabs/vibekit/views'

import { useState } from 'react'

import { Button, Copyable, Fact, Facts, FooterNote, Frame, Header, Hero } from '../../primitives'
import { shorten } from '../../theme'
import type { WalletLane } from '../../wallet/provider'
import { connectWallet } from './menu'

export function WalletScreen({
  lane,
  network,
  onOpenAccount,
  onListAccounts,
  onError,
}: {
  lane: WalletLane
  network: LiveNetworkId
  onOpenAccount: (address: string) => void
  /** Lists every connected account with balances as a feed card. */
  onListAccounts: () => void
  onError: (message: string) => void
}) {
  const [error, setError] = useState<string | undefined>(undefined)
  const run = (task: () => Promise<unknown>) => {
    setError(undefined)
    void task().catch((caught: unknown) => {
      const message = caught instanceof Error ? caught.message : String(caught)
      setError(message)
      onError(message)
    })
  }
  const active = lane.activeWallet
  return (
    <section className="screen">
      <header className="screen-title">
        <span className="kicker">wallet</span>
        <span className="muted"> · {network}</span>
      </header>
      <Frame>
        <Header kicker="WALLET" chip={network} pill={active ? 'CONNECTED' : 'NO WALLET'} tone={active ? 'ok' : 'idle'} />
        <Hero value={lane.activeAddress ? (lane.activeName ?? shorten(lane.activeAddress, 16)) : 'Connect a wallet'} />
        {lane.networkError ? <p className="note note-error">{lane.networkError}</p> : null}
        {error ? <p className="note note-error">{error}</p> : null}
        {!lane.isReady ? (
          <FooterNote text="wallet adapters loading…" />
        ) : (
          <div className="actions">
            {lane.wallets.map((wallet) => (
              <Button
                key={wallet.id}
                label={wallet.isConnected ? (wallet.isActive ? `${wallet.metadata.name} · disconnect` : `${wallet.metadata.name} · use`) : `connect ${wallet.metadata.name}`}
                active={wallet.isActive}
                onPress={() =>
                  run(async () => {
                    if (wallet.isConnected) {
                      if (wallet.isActive) await wallet.disconnect()
                      else wallet.setActive()
                      return
                    }
                    await connectWallet(wallet, lane.wallets)
                  })
                }
              />
            ))}
          </div>
        )}
        {active && lane.accounts.length > 0 ? (
          <>
            <Facts>
              {lane.accounts.map((account) => (
                <Fact key={account.address} label={account.name ?? 'account'}>
                  <Copyable value={account.address} width={24} />{' '}
                  {account.address === lane.activeAddress ? (
                    <span className="chip chip-ok">active</span>
                  ) : (
                    <Button label="set active" onPress={() => active.setActiveAccount(account.address)} />
                  )}
                </Fact>
              ))}
            </Facts>
            <div className="actions">
              <Button label="balances ▸" onPress={onListAccounts} />
            </div>
          </>
        ) : null}
        <FooterNote text="Keys stay in the wallet. Approving a payment opens the wallet to sign; the server verifies the signed bytes match the approved draft before broadcasting." />
      </Frame>
    </section>
  )
}
