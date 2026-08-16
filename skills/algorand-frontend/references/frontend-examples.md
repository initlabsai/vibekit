# Frontend Examples

## Contents
- [Shared App Setup](#shared-app-setup)
- [Example 1: Minimal Wallet Connection](#example-1-minimal-wallet-connection)
- [Example 2: Contract Interaction (Existing App)](#example-2-contract-interaction-existing-app)
- [Example 3: Deploy and Call Contract](#example-3-deploy-and-call-contract)
- [Example 4: Send Payment](#example-4-send-payment)
- [Example 5: Multiple Account Selection](#example-5-multiple-account-selection)
- [Example 6: Contract with Arguments](#example-6-contract-with-arguments)
- [Example 7: Read Global State](#example-7-read-global-state)
- [Example 8: Custom Hook for Contract](#example-8-custom-hook-for-contract)
- [Example 9: Vanilla JS/TS (No Framework)](#example-9-vanilla-jsts-no-framework)
- [Example 10: Pre-built WalletButton (Zero Custom UI)](#example-10-pre-built-walletbutton-zero-custom-ui)
- [Example 11: Data Fetching with Ref Pattern](#example-11-data-fetching-with-ref-pattern)
- [Example 12: ASA Opt-In and Transfer](#example-12-asa-opt-in-and-transfer)
- [Example 13: Network-Aware App Client](#example-13-network-aware-app-client)

Complete, minimal examples for Algorand frontends.

> **Framework note:** Examples use React. For Vue, SolidJS, Svelte, or Vanilla JS/TS, apply the reactive access patterns from the comparison table in [wallet-integration.md](./wallet-integration.md#reactive-state-access). The `AlgorandClient` and typed app client code is identical across all frameworks — only the wallet state access differs.

## Shared App Setup

All React examples assume this root `App.tsx` with `WalletProvider`. Only the child component changes per example.

```tsx
import { NetworkId, WalletId, WalletManager, WalletProvider } from '@txnlab/use-wallet-react'

const walletManager = new WalletManager({
  wallets: [WalletId.PERA, WalletId.DEFLY],
  defaultNetwork: NetworkId.TESTNET,
})

export default function App() {
  return (
    <WalletProvider manager={walletManager}>
      <YourComponent />
    </WalletProvider>
  )
}
```

---

## Example 1: Minimal Wallet Connection

```tsx
import { useWallet } from '@txnlab/use-wallet-react'

export function WalletConnect() {
  const { wallets, activeAddress, activeWallet } = useWallet()

  if (activeAddress) {
    return (
      <div>
        <p>Connected: {activeAddress.slice(0, 8)}...{activeAddress.slice(-4)}</p>
        <button onClick={() => activeWallet?.disconnect()}>Disconnect</button>
      </div>
    )
  }

  return (
    <div>
      <h2>Connect Wallet</h2>
      {wallets.map((wallet) => (
        <button key={wallet.id} onClick={() => wallet.connect()}>
          {wallet.metadata.name}
        </button>
      ))}
    </div>
  )
}
```

---

## Example 2: Contract Interaction (Existing App)

Connect to an already-deployed contract by App ID.

```tsx
import { useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { HelloWorldClient } from './contracts/HelloWorldClient'

const APP_ID = 12345n // Replace with your App ID

export function ContractDemo() {
  const { transactionSigner, activeAddress } = useWallet()
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const callContract = async () => {
    if (!activeAddress || !transactionSigner) return

    setLoading(true)
    try {
      const algorand = AlgorandClient.testNet()
      algorand.setSigner(activeAddress, transactionSigner)

      const appClient = algorand.client.getTypedAppClientById(HelloWorldClient, {
        appId: APP_ID,
        defaultSender: activeAddress,
      })

      const response = await appClient.send.hello({ args: { name: 'World' } })
      setResult(response.return ?? 'No return value')
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  if (!activeAddress) return <p>Connect wallet first.</p>

  return (
    <div>
      <p>Connected: {activeAddress.slice(0, 8)}...</p>
      <button onClick={callContract} disabled={loading}>
        {loading ? 'Calling...' : 'Call hello()'}
      </button>
      {result && <p>Result: {result}</p>}
    </div>
  )
}
```

---

## Example 3: Deploy and Call Contract

Deploy a new contract instance from the frontend.

```tsx
import { useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { HelloWorldFactory } from './contracts/HelloWorldClient'

export function DeployContract() {
  const { transactionSigner, activeAddress } = useWallet()
  const [appId, setAppId] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(false)

  const deployContract = async () => {
    if (!activeAddress || !transactionSigner) return

    setLoading(true)
    try {
      const algorand = AlgorandClient.testNet()
      algorand.setSigner(activeAddress, transactionSigner)

      const factory = new HelloWorldFactory({ algorand, defaultSender: activeAddress })
      const { appClient } = await factory.deploy({ onSchemaBreak: 'append', onUpdate: 'append' })
      setAppId(appClient.appId)
    } catch (error) {
      console.error('Deploy failed:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!activeAddress) return <p>Connect wallet first.</p>

  return (
    <div>
      <button onClick={deployContract} disabled={loading}>
        {loading ? 'Deploying...' : 'Deploy Contract'}
      </button>
      {appId && <p>Deployed! App ID: {appId.toString()}</p>}
    </div>
  )
}
```

---

## Example 4: Send Payment

```tsx
import { useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgorandClient, algo } from '@algorandfoundation/algokit-utils'

export function SendPayment() {
  const { transactionSigner, activeAddress } = useWallet()
  const [receiver, setReceiver] = useState('')
  const [txId, setTxId] = useState('')

  const sendPayment = async () => {
    if (!activeAddress || !transactionSigner || !receiver) return

    const algorand = AlgorandClient.testNet()
    const result = await algorand.send.payment({
      sender: activeAddress,
      receiver,
      amount: algo(1),
      signer: transactionSigner,
    })
    setTxId(result.txIds[0])
  }

  if (!activeAddress) return <p>Connect wallet first.</p>

  return (
    <div>
      <input type="text" placeholder="Receiver address" value={receiver}
        onChange={(e) => setReceiver(e.target.value)} />
      <button onClick={sendPayment} disabled={receiver.length !== 58}>Send 1 ALGO</button>
      {txId && <p>Sent! TX: {txId}</p>}
    </div>
  )
}
```

---

## Example 5: Multiple Account Selection

```tsx
import { useWallet } from '@txnlab/use-wallet-react'

export function AccountSelector() {
  const { activeWallet, activeWalletAccounts, activeAddress } = useWallet()

  if (!activeWallet || activeWalletAccounts.length <= 1) return null

  return (
    <select value={activeAddress ?? ''}
      onChange={(e) => activeWallet.setActiveAccount(e.target.value)}>
      {activeWalletAccounts.map((account) => (
        <option key={account.address} value={account.address}>
          {account.name || account.address.slice(0, 8) + '...'}
        </option>
      ))}
    </select>
  )
}
```

---

## Example 6: Contract with Arguments

```tsx
import { useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { CounterClient } from './contracts/CounterClient'

const APP_ID = 12345n

export function CounterContract() {
  const { transactionSigner, activeAddress } = useWallet()
  const [count, setCount] = useState<bigint | null>(null)

  const getClient = () => {
    if (!activeAddress || !transactionSigner) return null
    const algorand = AlgorandClient.testNet()
    algorand.setSigner(activeAddress, transactionSigner)
    return algorand.client.getTypedAppClientById(CounterClient, {
      appId: APP_ID, defaultSender: activeAddress,
    })
  }

  const increment = async () => {
    const client = getClient()
    if (!client) return
    const result = await client.send.increment()
    setCount(result.return ?? 0n)
  }

  const add = async (value: bigint) => {
    const client = getClient()
    if (!client) return
    const result = await client.send.add({ args: { value } })
    setCount(result.return ?? 0n)
  }

  if (!activeAddress) return <p>Connect wallet first.</p>

  return (
    <div>
      <p>Count: {count?.toString() ?? 'Unknown'}</p>
      <button onClick={increment}>Increment</button>
      <button onClick={() => add(5n)}>Add 5</button>
    </div>
  )
}
```

---

## Example 7: Read Global State

Read contract global state without sending a transaction.

```tsx
import { useState, useEffect } from 'react'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { MyContractClient } from './contracts/MyContractClient'

const APP_ID = 12345n

export function ReadState() {
  const [globalState, setGlobalState] = useState<Record<string, unknown>>({})

  useEffect(() => {
    const fetchState = async () => {
      const algorand = AlgorandClient.testNet()
      // Reading state doesn't require a signer
      const appClient = algorand.client.getTypedAppClientById(MyContractClient, { appId: APP_ID })
      const state = await appClient.state.global.getAll()
      setGlobalState(state as Record<string, unknown>)
    }
    fetchState()
  }, [])

  return <pre>{JSON.stringify(globalState, null, 2)}</pre>
}
```

---

## Example 8: Custom Hook for Contract

> **Warning:** The `client` returned by this hook is a new object reference whenever wallet state changes. Do not use `client` directly as a `useCallback`/`useEffect` dependency — see [wallet-integration.md](./wallet-integration.md#hook-dependency-stability-infinite-re-render-prevention) and Example 11.

```tsx
import { useMemo } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { MyContractClient } from './contracts/MyContractClient'

const APP_ID = 12345n

export function useContract() {
  const { transactionSigner, activeAddress, isReady } = useWallet()

  const client = useMemo(() => {
    if (!activeAddress || !transactionSigner || !isReady) return null
    const algorand = AlgorandClient.testNet()
    algorand.setSigner(activeAddress, transactionSigner)
    return algorand.client.getTypedAppClientById(MyContractClient, {
      appId: APP_ID, defaultSender: activeAddress,
    })
  }, [activeAddress, transactionSigner, isReady])

  const algorand = useMemo(() => {
    if (!activeAddress || !transactionSigner || !isReady) return null
    const a = AlgorandClient.testNet()
    a.setSigner(activeAddress, transactionSigner)
    return a
  }, [activeAddress, transactionSigner, isReady])

  return { client, algorand, isConnected: !!activeAddress, address: activeAddress }
}
```

**Button click usage (safe — no dependency issues):**

```tsx
const { client, isConnected } = useContract()

const callMethod = async () => {
  if (!client) return
  const result = await client.send.myMethod({ args: { value: 42n } })
}

if (!isConnected) return <p>Connect wallet first</p>
return <button onClick={callMethod}>Call Method</button>
```

---

## Example 9: Vanilla JS/TS (No Framework)

```ts
import { WalletManager, WalletId, NetworkId } from '@txnlab/use-wallet'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { HelloWorldClient } from './contracts/HelloWorldClient'

const APP_ID = 12345n
const manager = new WalletManager({
  wallets: [WalletId.PERA, WalletId.DEFLY],
  defaultNetwork: NetworkId.TESTNET,
})
await manager.resumeSessions()

manager.subscribe((state) => {
  document.getElementById('status')!.textContent = state.activeAddress
    ? `Connected: ${state.activeAddress.slice(0, 8)}...`
    : 'Not connected'
})

document.getElementById('connect')!.addEventListener('click', async () => {
  const pera = manager.wallets.find((w) => w.id === WalletId.PERA)
  if (pera) await pera.connect()
})

document.getElementById('call')!.addEventListener('click', async () => {
  const { activeAddress, transactionSigner } = manager.store.getState()
  if (!activeAddress || !transactionSigner) return

  const algorand = AlgorandClient.testNet()
  algorand.setSigner(activeAddress, transactionSigner)
  const appClient = algorand.client.getTypedAppClientById(HelloWorldClient, {
    appId: APP_ID, defaultSender: activeAddress,
  })
  const result = await appClient.send.hello({ args: { name: 'World' } })
  document.getElementById('result')!.textContent = `Result: ${result.return}`
})
```

---

## Example 10: Pre-built WalletButton (Zero Custom UI)

```tsx
import { WalletButton } from '@txnlab/use-wallet-ui-react'
// Add <WalletButton /> inside WalletProvider — handles connect/disconnect automatically
```

Install: `npm install @txnlab/use-wallet-ui-react`

Requires Tailwind CSS. See [wallet-integration.md](./wallet-integration.md#pre-built-ui-components) for Tailwind v3/v4 config.

---

## Example 11: Data Fetching with Ref Pattern

Combine the custom hook from Example 8 with automatic data fetching on mount — without infinite re-renders.

```tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useContract } from './useContract'

function Listings() {
  const { client, algorand, isConnected } = useContract()
  const [data, setData] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(false)

  // Refs always hold the latest values without causing re-renders
  const clientRef = useRef(client)
  const algorandRef = useRef(algorand)
  clientRef.current = client
  algorandRef.current = algorand

  // Stable callback — no object dependencies
  const fetchData = useCallback(async () => {
    const c = clientRef.current
    if (!c) return
    setLoading(true)
    try {
      const state = await c.state.global.getAll()
      setData(state as Record<string, unknown>)
    } finally {
      setLoading(false)
    }
  }, []) // empty deps — stable across renders

  useEffect(() => {
    if (isConnected) fetchData()
  }, [isConnected, fetchData])

  if (!isConnected) return <p>Connect wallet first</p>
  if (loading) return <p>Loading...</p>

  return (
    <div>
      <pre>{JSON.stringify(data, null, 2)}</pre>
      <button onClick={fetchData}>Refresh</button>
    </div>
  )
}
```

| Scenario | Pattern | Example |
|----------|---------|---------|
| Read-only, no signer needed | Inline client in `useEffect` with `[]` deps | Example 7 |
| Write-only via button click | Hook + `onClick` handler directly | Example 8 |
| Read on mount + write via button | Hook + ref pattern for reads | Example 11 (this) |

---

## Example 12: ASA Opt-In and Transfer

```tsx
import { useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'

const ASSET_ID = 12345n

export function AssetTransfer() {
  const { transactionSigner, activeAddress } = useWallet()
  const [status, setStatus] = useState('')

  const optIn = async () => {
    if (!activeAddress || !transactionSigner) return
    const algorand = AlgorandClient.testNet()
    algorand.setSigner(activeAddress, transactionSigner)
    await algorand.send.assetOptIn({ sender: activeAddress, assetId: ASSET_ID })
    setStatus('Opted in!')
  }

  const transfer = async (receiver: string, amount: bigint) => {
    if (!activeAddress || !transactionSigner) return
    const algorand = AlgorandClient.testNet()
    algorand.setSigner(activeAddress, transactionSigner)
    const result = await algorand.send.assetTransfer({
      sender: activeAddress, receiver, assetId: ASSET_ID, amount,
    })
    setStatus(`Transferred! TX: ${result.txIds[0]}`)
  }

  if (!activeAddress) return <p>Connect wallet first.</p>

  return (
    <div>
      <button onClick={optIn}>Opt In to ASA {ASSET_ID.toString()}</button>
      <button onClick={() => transfer('RECEIVERADDRESS...', 1n)}>Transfer 1 Unit</button>
      {status && <p>{status}</p>}
    </div>
  )
}
```

---

## Example 13: Network-Aware App Client

Use `getTypedAppClientByNetwork()` with `useNetwork()` to automatically resolve the correct App ID for the active network. Requires an ARC-56 app spec with network-specific App IDs in the `networks` field.

```tsx
import { useState } from 'react'
import { useWallet, useNetwork } from '@txnlab/use-wallet-react'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { MyContractClient } from './contracts/MyContractClient'

export function NetworkAwareContract() {
  const { transactionSigner, activeAddress } = useWallet()
  const { activeNetwork } = useNetwork()
  const [result, setResult] = useState('')

  const callContract = async () => {
    if (!activeAddress || !transactionSigner) return
    const algorand = AlgorandClient[activeNetwork === 'mainnet' ? 'mainNet' : 'testNet']()
    algorand.setSigner(activeAddress, transactionSigner)

    const appClient = await algorand.client.getTypedAppClientByNetwork(MyContractClient, {
      defaultSender: activeAddress,
    })
    const response = await appClient.send.myMethod({ args: { value: 42n } })
    setResult(`Result: ${response.return} (network: ${activeNetwork})`)
  }

  if (!activeAddress) return <p>Connect wallet first.</p>

  return (
    <div>
      <p>Network: {activeNetwork}</p>
      <button onClick={callContract}>Call Contract</button>
      {result && <p>{result}</p>}
    </div>
  )
}
```
