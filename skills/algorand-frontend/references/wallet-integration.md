# Frontend Wallet Integration Reference

## Contents
- [Dependencies](#dependencies)
- [WalletManager Configuration](#walletmanager-configuration)
- [Framework Setup](#framework-setup)
- [useWallet() Hook](#usewallet-hook)
- [useNetwork() Hook](#usenetwork-hook)
- [Pre-built UI Components](#pre-built-ui-components)
- [AlgorandClient Signer Methods](#algorandclient-signer-methods)
- [AlgorandClient Factory Methods](#algorandclient-factory-methods)
- [Typed App Client Methods](#typed-app-client-methods)
- [Typed App Factory](#typed-app-factory)
- [Calling Contract Methods](#calling-contract-methods)
- [Payment Transactions](#payment-transactions)
- [Error Handling](#error-handling)
- [Gotchas](#gotchas)
- [Custom AVM Networks](#custom-avm-networks)

Detailed API reference for building Algorand frontends with any JavaScript/TypeScript framework.

## Dependencies

### Core Packages

```json
{
  "dependencies": {
    "@algorandfoundation/algokit-utils": "^9.0.0",
    "algosdk": "^3.0.0"
  }
}
```

### Framework Adapter Packages

Install **one** adapter package for your framework:

| Framework | Package | Import path |
|-----------|---------|-------------|
| React | `@txnlab/use-wallet-react` | `@txnlab/use-wallet-react` |
| Vue | `@txnlab/use-wallet-vue` | `@txnlab/use-wallet-vue` |
| SolidJS | `@txnlab/use-wallet-solid` | `@txnlab/use-wallet-solid` |
| Svelte | `@txnlab/use-wallet-svelte` | `@txnlab/use-wallet-svelte` |
| Vanilla JS/TS | `@txnlab/use-wallet` | `@txnlab/use-wallet` |

### Wallet Provider Packages

Install peer dependencies only for wallets you support:

| Wallet | `WalletId` | Package | Config required |
|--------|-----------|---------|-----------------|
| Pera | `PERA` | `@perawallet/connect` | none |
| Defly | `DEFLY` | `@blockshake/defly-connect` | none |
| Exodus | `EXODUS` | none (built-in) | none (MainNet only) |
| Kibisis | `KIBISIS` | `@agoralabs-sh/avm-web-provider` | none |
| Lute | `LUTE` | `lute-connect` | none |
| WalletConnect | `WALLETCONNECT` | `@walletconnect/modal` + `@walletconnect/sign-client` | `options: { projectId }` |
| Biatec | `BIATEC` | `biatec-connect` | none |
| Magic | `MAGIC` | `magic-sdk` + `@magic-ext/algorand` | `options: { apiKey }` |
| Web3Auth | `WEB3AUTH` | `@web3auth/single-factor-auth` | `options: { clientId, pnpClientId, verifier, loginProvider }` |
| Liquid Auth | `LIQUID` | `@siwa/connect` | `options: { url }` |
| KMD | `KMD` | none (built-in) | `options: { baseServer, port, token, wallet }` |
| Mnemonic | `MNEMONIC` | none (built-in) | `options: { mnemonic }` (testing only) |
| Custom | `CUSTOM` | user-provided | `options: { provider }` |

Example with WalletConnect:
```ts
{
  id: WalletId.WALLETCONNECT,
  options: { projectId: 'YOUR_WALLETCONNECT_PROJECT_ID' }
}
```

Install example for Pera + Defly:
```bash
npm install @perawallet/connect @blockshake/defly-connect
```

## WalletManager Configuration

Create a `WalletManager` instance to configure available wallets. **Create this outside component render** to avoid re-initialization.

```ts
import { NetworkId, WalletId, WalletManager } from '@txnlab/use-wallet-react'

const walletManager = new WalletManager({
  wallets: WalletId[] | WalletConfig[],
  defaultNetwork: NetworkId | string,
  networks?: NetworkConfig,
  options?: ManagerOptions,
})
```

### Network IDs

```ts
NetworkId.MAINNET   // 'mainnet'
NetworkId.TESTNET   // 'testnet'
NetworkId.BETANET   // 'betanet'
```

### Basic Configuration

```ts
// TestNet/MainNet with popular wallets
const walletManager = new WalletManager({
  wallets: [WalletId.PERA, WalletId.DEFLY, WalletId.EXODUS],
  defaultNetwork: NetworkId.TESTNET,
})
```

### Custom Network Configuration

```ts
const walletManager = new WalletManager({
  wallets: [WalletId.PERA, WalletId.DEFLY],
  defaultNetwork: NetworkId.TESTNET,
  networks: {
    [NetworkId.TESTNET]: {
      algod: {
        baseServer: 'https://testnet-api.algonode.cloud',
        port: '',
        token: '',
      },
    },
  },
})
```

### LocalNet Configuration (Development)

```ts
const walletManager = new WalletManager({
  wallets: [
    {
      id: WalletId.KMD,
      options: {
        baseServer: 'http://localhost',
        port: '4002',
        token: 'a'.repeat(64),
        wallet: 'unencrypted-default-wallet',
      },
    },
  ],
  defaultNetwork: 'localnet',
  networks: {
    localnet: {
      algod: {
        baseServer: 'http://localhost',
        port: '4001',
        token: 'a'.repeat(64),
      },
    },
  },
})
```

## Framework Setup

### Provider Initialization

**React** (most common — see [frontend-examples.md](./frontend-examples.md) for full examples):
```tsx
import { WalletProvider } from '@txnlab/use-wallet-react'
<WalletProvider manager={walletManager}><App /></WalletProvider>
```

Other frameworks use their adapter's equivalent: Vue uses `WalletManagerPlugin`, SolidJS uses `WalletProvider`, Svelte uses `WalletManagerContextProvider`. Vanilla JS/TS uses `WalletManager` directly (no provider) — see [frontend-examples.md Example 9](./frontend-examples.md#example-9-vanilla-jsts-no-framework).

### Reactive State Access

How to read wallet state varies by framework:

| Value | React | Vue `<script setup>` | SolidJS | Svelte | Vanilla |
|-------|-------|----------------------|---------|--------|---------|
| `activeAddress` | `addr` (direct) | `addr.value` | `addr()` | `$addr` / `.current` | `manager.activeAddress` |
| `transactionSigner` | direct | direct | direct | direct | `manager.transactionSigner` |
| `wallets` | direct | `.value` | `()` | `$wallets` / `.current` | `manager.wallets` |
| Subscribe to changes | automatic | automatic | automatic | automatic | `manager.subscribe(callback)` |

In all frameworks, `transactionSigner` is a plain function — no unwrapping needed.

## useWallet() Hook

The primary hook for wallet interactions (available in all framework adapters):

```ts
const {
  // Wallet state
  wallets,              // Wallet[] - all available wallets
  isReady,              // boolean - manager initialized

  // Active wallet info
  activeWallet,         // Wallet | null - current wallet
  activeAddress,        // string | null - current address
  activeWalletAccounts, // WalletAccount[] - accounts in active wallet
  activeWalletAddresses,// string[] | null - addresses from active wallet
  activeAccount,        // WalletAccount | null - active account object

  // Signing
  transactionSigner,    // TransactionSigner - for signing txns
  signTransactions,     // (txns, indexes?) => Promise<Uint8Array[]>
  signData,             // (data, metadata?) => Promise<Uint8Array[]>
  withPrivateKey,       // (fn) => Promise<T> - access private key in callback

  // Clients
  algodClient,          // Algodv2 - algod client instance
  setAlgodClient,       // (client: Algodv2) => void - override algod client
} = useWallet()
```

### Wallet Object

Each wallet in the `wallets` array has:

```ts
interface Wallet {
  id: WalletId
  metadata: { name: string; icon: string }
  accounts: WalletAccount[]
  activeAccount: WalletAccount | null
  isConnected: boolean
  isActive: boolean

  // Methods
  connect: () => Promise<WalletAccount[]>
  disconnect: () => Promise<void>
  setActive: () => void
  setActiveAccount: (address: string) => void
}
```

### WalletAccount Object

```ts
interface WalletAccount {
  name: string
  address: string
}
```

## useNetwork() Hook

Separated from `useWallet()` in v4. Use this for network switching:

```ts
import { useNetwork } from '@txnlab/use-wallet-react' // or -vue, -solid, -svelte

const {
  activeNetwork,        // string - current network ID
  setActiveNetwork,     // (networkId: string) => void
  networkConfig,        // NetworkConfig - all configured networks
  activeNetworkConfig,  // NetworkConfig[activeNetwork] - config for current network
  updateAlgodConfig,    // (config) => void - update algod config for active network
  resetNetworkConfig,   // () => void - reset network config to defaults
} = useNetwork()
```

Note: `algodClient` is available on `useWallet()`, not `useNetwork()`.

Switch network:
```ts
import { NetworkId } from '@txnlab/use-wallet-react'
setActiveNetwork(NetworkId.MAINNET)
```

When using vanilla JS/TS, use `manager.setActiveNetwork(NetworkId.MAINNET)` directly.

## Pre-built UI Components

The `@txnlab/use-wallet-ui-react` package provides ready-made wallet connection UI:

```bash
npm install @txnlab/use-wallet-ui-react
```

```tsx
import { WalletButton } from '@txnlab/use-wallet-ui-react'

function App() {
  return <WalletButton />  // Renders connect/disconnect with wallet selector
}
```

Requires Tailwind CSS. For Tailwind v4, add to your CSS:
```css
@source "../node_modules/@txnlab/use-wallet-ui-react";
```

For Tailwind v3, add to `tailwind.config.js` content array:
```js
'./node_modules/@txnlab/use-wallet-ui-react/**/*.{js,ts,jsx,tsx}'
```

## AlgorandClient Signer Methods

Register wallet signers with `AlgorandClient`:

```ts
import { AlgorandClient } from '@algorandfoundation/algokit-utils'

const algorand = AlgorandClient.testNet()

// Register signer for specific address
algorand.setSigner(address: string, signer: TransactionSigner)

// Register signer from account object
algorand.setSignerFromAccount(account: { addr: string; signer: TransactionSigner })

// Set default signer for all transactions
algorand.setDefaultSigner(signer: TransactionSigner)
```

### Signer Resolution Order

When sending transactions, AlgorandClient resolves signers in this order:

1. Explicit `signer` parameter in the method call
2. Registered signer for the sender address (via `setSigner()`)
3. Default signer (via `setDefaultSigner()`)

If you've called `setSigner()` for an address, you don't need to pass `signer:` inline — it's resolved automatically. Passing `signer:` inline is useful for one-off transactions without pre-registration (e.g., `algorand.send.payment({ ..., signer: transactionSigner })`).

## AlgorandClient Factory Methods

```ts
AlgorandClient.mainNet()          // MainNet via AlgoNode
AlgorandClient.testNet()          // TestNet via AlgoNode
AlgorandClient.defaultLocalNet()  // LocalNet defaults
```

## Typed App Client Methods

### Get Client by App ID

```ts
const appClient = algorand.client.getTypedAppClientById(
  MyContractClient,  // Generated client class
  {
    appId: 12345n,                    // Required: App ID
    defaultSender: activeAddress,     // Optional: default sender
    defaultSigner: transactionSigner, // Optional: explicit signer
  }
)
```

### Get Client by Creator and Name

```ts
const appClient = await algorand.client.getTypedAppClientByCreatorAndName(
  MyContractClient,
  {
    creatorAddress: 'ABC123...',
    appName: 'MyContract',         // Optional: defaults to spec name
    defaultSender: activeAddress,
  }
)
```

### Get Client by Network (ARC-56)

For contracts with network-specific App IDs in their spec:

```ts
const appClient = await algorand.client.getTypedAppClientByNetwork(
  MyContractClient,
  {
    defaultSender: activeAddress,
  }
)
```

## Typed App Factory

Use factories to deploy new contracts from the frontend. See [frontend-examples.md Example 3](./frontend-examples.md#example-3-deploy-and-call-contract) for a complete React component. For full factory API details, see the `algorand-typescript` skill's `deploy-interaction.md`.

## Calling Contract Methods

### Send (Execute Transaction)

```ts
// Single method call
const result = await appClient.send.methodName({
  args: { param1: 'value', param2: 42n },
})

console.log(result.return)     // Return value
console.log(result.txIds)      // Transaction IDs
console.log(result.transaction) // Transaction object
```

### Simulate (Dry Run)

```ts
// Test without submitting
const simResult = await appClient.newGroup()
  .methodName({ args: { param1: 'value' } })
  .simulate()

console.log(simResult.returns[0]) // Simulated return value
```

### Chained Calls (Atomic Group)

```ts
const result = await appClient.newGroup()
  .method1({ args: { ... } })
  .method2({ args: { ... } })
  .send()
```

## Payment Transactions

Send ALGO payments using the wallet signer:

```ts
import { algo } from '@algorandfoundation/algokit-utils'

const result = await algorand.send.payment({
  sender: activeAddress,
  receiver: 'RECIPIENTADDRESS...',
  amount: algo(1),  // 1 ALGO
  signer: transactionSigner,
})
```

## Error Handling

Common error message patterns: `"rejected"` = user cancelled in wallet, `"below min"` = insufficient funds.

## Gotchas

### Next.js Webpack Fallback

Next.js builds fail without Node.js polyfill fallbacks. Add `crypto: false, buffer: false, stream: false` to `webpack.resolve.fallback` in `next.config.js`.

### SSR Hydration (`isReady`)

In SSR frameworks (Next.js, Nuxt, SvelteKit), wallet state is `null` on the server. Always check `isReady` before rendering wallet-dependent UI to prevent hydration mismatches:

```tsx
const { isReady, activeAddress } = useWallet()
if (!isReady) return <div>Loading...</div>
```

### User Interaction Signing Requirement

Some wallets (especially mobile wallets like Pera) require signing to be triggered from a direct user interaction (button click). Signing from `useEffect`, `setTimeout`, or `onMount` may silently fail or be blocked by the wallet. Always trigger signing from `onClick` or equivalent event handlers.

### Hook Dependency Stability (Infinite Re-render Prevention)

Custom hooks that wrap `AlgorandClient` or typed app clients return **new object references** whenever wallet state changes. Never use these objects as `useCallback`/`useEffect` dependencies — use refs instead. See [frontend-examples.md Example 11](./frontend-examples.md#example-11-data-fetching-with-ref-pattern) for the complete pattern.

### Wallet Network Compatibility

Not all wallets support all networks:
- **Exodus**: MainNet only
- **KMD**: LocalNet only
- **Mnemonic**: All networks (testing only — never in production)

### Create WalletManager Outside Component Render

Always instantiate `WalletManager` outside of component render functions. Creating it inside a component causes re-initialization on every render.

## Custom AVM Networks

Use `NetworkConfigBuilder` to add non-Algorand AVM networks (e.g., Voi):

```ts
import { NetworkConfigBuilder } from '@txnlab/use-wallet' // or any adapter

const networks = new NetworkConfigBuilder()
  .addNetwork('voi-testnet', {
    algod: {
      baseServer: 'https://testnet-api.voi.nodely.dev',
      port: '',
      token: '',
    },
  })
  .build()

const walletManager = new WalletManager({
  wallets: [WalletId.KIBISIS],
  defaultNetwork: 'voi-testnet',
  networks,
})
```

