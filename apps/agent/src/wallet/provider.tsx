'use client'

/**
 * The browser wallet: one WalletManager for the page (Pera and Lute), the
 * provider that mounts it, and the lane the Explorer reads — connected
 * accounts, the active address, and a `signDraft` that exists only while a
 * wallet is connected. Imported from the page, never from the layout.
 */
import { lute } from '@txnlab/use-wallet-lute'
import { pera } from '@txnlab/use-wallet-pera'
import { useNetwork as useWalletNetwork, useWallet, WalletManager, WalletProvider } from '@txnlab/use-wallet-react'
import type { LiveNetworkId } from '@initlabs/vibekit-explorer'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import type { WalletAccount } from '../commands'
import { defaultNetwork } from '../features/network/hooks'
import { createWalletSignDraft } from './sign-draft'

const manager = new WalletManager({
  wallets: [pera(), lute({ siteName: 'VibeKit Explorer' })],
  defaultNetwork: defaultNetwork(),
})

/**
 * Loads each adapter's client ahead of the click that connects. Lute's
 * extension opens its panel only inside the click's user activation, and the
 * adapter's first connect would otherwise spend that on a lazy import.
 */
export function warmWallets(): void {
  for (const wallet of manager.wallets) {
    void (wallet as { initializeClient?: () => Promise<unknown> }).initializeClient?.().catch(() => undefined)
  }
}

export function WalletRoot({ children }: { children: ReactNode }) {
  return <WalletProvider manager={manager}>{children}</WalletProvider>
}

export type WalletLane = ReturnType<typeof useWalletLane>

/** What the Explorer needs from the wallet, on the Explorer's network. */
export function useWalletLane(network: LiveNetworkId) {
  const wallet = useWallet()
  const { activeNetwork, setActiveNetwork } = useWalletNetwork()
  const [networkError, setNetworkError] = useState<string | undefined>(undefined)

  // The Explorer's network is the source of truth; the wallet follows it or says why not.
  useEffect(() => {
    if (!wallet.isReady || activeNetwork === network) {
      setNetworkError(undefined)
      return
    }
    setActiveNetwork(network).then(
      () => setNetworkError(undefined),
      (error: unknown) =>
        setNetworkError(`Wallet is on ${activeNetwork}; Explorer is on ${network} — ${error instanceof Error ? error.message : String(error)}`),
    )
  }, [activeNetwork, network, setActiveNetwork, wallet.isReady])

  const accounts: ReadonlyArray<WalletAccount> = useMemo(
    () => (wallet.activeWalletAccounts ?? []).map((account) => ({ address: account.address, name: account.name })),
    [wallet.activeWalletAccounts],
  )
  const activeAddress = wallet.activeAddress ?? undefined
  // use-wallet hands out a fresh transactionSigner each render; read it through a ref so
  // signDraft (and everything memoised on it) changes only with the account or network.
  const signerRef = useRef(wallet.transactionSigner)
  signerRef.current = wallet.transactionSigner
  const signDraft = useMemo(
    () =>
      activeAddress
        ? createWalletSignDraft({
            network,
            walletNetwork: () => manager.activeNetwork,
            transactionSigner: (txns, indexes) => signerRef.current(txns, indexes),
          })
        : undefined,
    [activeAddress, network],
  )

  return {
    isReady: wallet.isReady,
    wallets: wallet.wallets,
    activeWallet: wallet.activeWallet,
    accounts,
    activeAddress,
    activeName: wallet.activeAccount?.name,
    signDraft,
    networkError,
  }
}
