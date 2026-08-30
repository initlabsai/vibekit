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
import { createWalletSignDraft, type LiveNetworkId } from '@initlabs/vibekit-explorer'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import type { WalletAccount } from '../commands'
import { defaultNetwork } from '../features/network/hooks'
import { recordSigned } from './sign-draft'

const manager = new WalletManager({
  wallets: [pera(), lute({ siteName: 'VibeKit Agent' })],
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

  // A purchase pins the wallet to the pack's chain for its duration; the chip never moves.
  const pinnedRef = useRef<LiveNetworkId | undefined>(undefined)
  const wanted = pinnedRef.current ?? network

  // The Explorer's network is the source of truth; the wallet follows it or says why not.
  useEffect(() => {
    if (!wallet.isReady || activeNetwork === wanted) {
      setNetworkError(undefined)
      return
    }
    setActiveNetwork(wanted).then(
      () => setNetworkError(undefined),
      (error: unknown) =>
        setNetworkError(`Wallet is on ${activeNetwork}; Explorer is on ${network} — ${error instanceof Error ? error.message : String(error)}`),
    )
  }, [activeNetwork, wanted, setActiveNetwork, wallet.isReady])

  /** Runs `task` with the wallet on `chain`, then returns it to the Explorer's network. */
  const withWalletNetwork = useCallback(
    async <T,>(chain: LiveNetworkId, task: () => Promise<T>): Promise<T> => {
      pinnedRef.current = chain
      try {
        if (manager.activeNetwork !== chain) await setActiveNetwork(chain)
        return await task()
      } finally {
        pinnedRef.current = undefined
        if (manager.activeNetwork !== network) await setActiveNetwork(network).catch(() => undefined)
      }
    },
    [network, setActiveNetwork],
  )

  // One wallet at a time. Sessions persist in the browser, so a second one connected before
  // that rule existed would still be here; the active wallet stays, the rest are dropped.
  useEffect(() => {
    if (!wallet.isReady) return
    for (const other of wallet.wallets) {
      if (other.isConnected && !other.isActive) void other.disconnect().catch(() => undefined)
    }
  }, [wallet.isReady, wallet.wallets])

  const accounts: ReadonlyArray<WalletAccount> = useMemo(
    () => (wallet.activeWalletAccounts ?? []).map((account) => ({ address: account.address, name: account.name })),
    [wallet.activeWalletAccounts],
  )
  const activeAddress = wallet.activeAddress ?? undefined
  // use-wallet hands out a fresh transactionSigner each render; read it through a ref so
  // signDraft (and everything memoised on it) changes only with the account or network.
  const signerRef = useRef(wallet.transactionSigner)
  signerRef.current = wallet.transactionSigner
  const signTxnsRef = useRef(wallet.signTransactions)
  signTxnsRef.current = wallet.signTransactions
  /** Raw group signing for x402: the wallet signs the bytes it is handed. */
  const signTransactions = useCallback(
    (txns: Uint8Array[], indexes?: number[]) => signTxnsRef.current(txns, indexes),
    [],
  )
  const signDraft = useMemo(
    () =>
      activeAddress
        ? createWalletSignDraft({
            network,
            walletNetwork: () => manager.activeNetwork,
            signer: (txns, indexes) => signerRef.current(txns, indexes),
            record: (draftRecord, signedTransactions) => recordSigned(network, draftRecord, signedTransactions),
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
    signTransactions,
    withWalletNetwork,
    networkError,
  }
}
