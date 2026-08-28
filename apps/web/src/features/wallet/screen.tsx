'use client'

/** The wallet screen: a branded connect menu over `useWallet().wallets`, and the connected accounts. */
import type { LiveNetworkId } from '@initlabs/vibekit-explorer'

import { Button, Copyable, Fact, Facts, FooterNote, Frame, Header, Hero } from '../../primitives'
import { shorten } from '../../theme'
import type { WalletLane } from '../../wallet/provider'

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
  const run = (task: () => Promise<unknown>) =>
    void task().catch((error: unknown) => onError(error instanceof Error ? error.message : String(error)))
  const active = lane.activeWallet
  return (
    <section className="feed">
      <Frame>
        <Header kicker="WALLET" chip={network} pill={active ? 'CONNECTED' : 'NO WALLET'} tone={active ? 'ok' : 'idle'} />
        <Hero value={lane.activeAddress ? (lane.activeName ?? shorten(lane.activeAddress, 16)) : 'Connect a wallet'} />
        {lane.networkError ? <p className="note note-error">{lane.networkError}</p> : null}
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
                    if (!wallet.isConnected) await wallet.connect()
                    else if (wallet.isActive) await wallet.disconnect()
                    else wallet.setActive()
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
                  )}{' '}
                  <Button label="open" onPress={() => onOpenAccount(account.address)} />
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
