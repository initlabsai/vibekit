---
name: algorand-frontend
description: Builds Algorand dApp frontends with wallet integration and typed contract clients. Supports React, Vue, SolidJS, Svelte, and vanilla JS/TS via @txnlab/use-wallet. Covers the signer handoff pattern, wallet provider setup, network configuration, and calling contract methods from frontend code. Use when creating a dApp UI, connecting wallets, integrating typed app clients with wallet signers, or calling smart contract methods from any JavaScript or TypeScript frontend framework.
---

# Algorand Frontends

Build frontend applications that connect to Algorand wallets and interact with smart contracts using typed clients. Works with React, Vue, SolidJS, Svelte, and vanilla JS/TS.

## Prerequisites

1. **Smart contract is deployed** with a known App ID
2. **ARC-56/ARC-32 app spec exists** (e.g., `MyContract.arc56.json`)
3. **Frontend project is set up** (Vite, Next.js, Nuxt, SvelteKit, or any bundler)

## Core Pattern: Signer Handoff

```
Wallet (use-wallet) → transactionSigner
                              ↓
                    AlgorandClient.setSigner()
                              ↓
                    Typed App Client (defaultSender)
                              ↓
                    Contract Method Calls (auto-signed)
```

## Quick Start

```bash
# Generate typed client
algokit generate client path/to/MyContract.arc56.json --output src/contracts/MyContractClient.ts

# Install core + framework adapter (pick one)
npm install @algorandfoundation/algokit-utils algosdk @txnlab/use-wallet-react   # React
npm install @algorandfoundation/algokit-utils algosdk @txnlab/use-wallet-vue     # Vue
npm install @algorandfoundation/algokit-utils algosdk @txnlab/use-wallet-solid   # SolidJS
npm install @algorandfoundation/algokit-utils algosdk @txnlab/use-wallet-svelte  # Svelte
npm install @algorandfoundation/algokit-utils algosdk @txnlab/use-wallet         # Vanilla JS/TS

# Install wallet peer dependencies (only for wallets you use)
npm install @perawallet/connect @blockshake/defly-connect
```

### Minimal Integration (React)

```tsx
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { MyContractClient } from './contracts/MyContractClient'

function ContractInteraction() {
  const { transactionSigner, activeAddress } = useWallet()

  const callContract = async () => {
    if (!activeAddress || !transactionSigner) return

    const algorand = AlgorandClient.testNet()
    algorand.setSigner(activeAddress, transactionSigner)

    const appClient = algorand.client.getTypedAppClientById(MyContractClient, {
      appId: 12345n,
      defaultSender: activeAddress,
    })

    const result = await appClient.send.myMethod({ args: { value: 42n } })
    console.log('Result:', result.return)
  }

  return <button onClick={callContract}>Call Contract</button>
}
```

## Important Rules

1. **Always call `setSigner()` before creating clients** — signer must be registered first
2. **Check for null `activeAddress` and `transactionSigner`** — null when no wallet connected
3. **Match networks** — AlgorandClient network must match WalletManager network
4. **Use `getTypedAppClientById()`** for frontends with known App IDs
5. **Check `isReady` before rendering wallet state** — prevents SSR hydration mismatches in Next.js, Nuxt, and SvelteKit
6. **Trigger signing from direct user interaction** — button clicks, not timers or effects. Some wallets (especially mobile) block or silently fail signing from `useEffect`/`onMount`/`setTimeout`
7. **Never use hook-returned clients as effect/callback dependencies** — `client` and `algorand` from custom hooks are new references on every wallet state change. Use refs for data fetching in effects (see Example 11 in frontend-examples.md)

## Reference Guide

- [wallet-integration.md](./references/wallet-integration.md) — Framework adapters, wallet providers, network config, useNetwork(), pre-built UI, gotchas
- [frontend-examples.md](./references/frontend-examples.md) — Complete code examples for common patterns

## Canonical Example Repos

Search these repositories for real-world code examples:

- **`algorandfoundation/algokit-fullstack-template`** — Fullstack project template (React + contracts)
- **`algorandfoundation/algokit-react-frontend-template`** — React frontend template
- **`TxnLab/use-wallet`** — UseWallet library source and framework adapters
- **`TxnLab/next-use-wallet`** — Next.js + UseWallet example app

## Cross-References

- **New to Algorand?** Read `algorand-core` skill first for AVM mental model
- **Smart contracts**: See `algorand-typescript` or `algorand-python` skills
- **Project scaffolding and CLI**: See `algorand-project-setup` skill
