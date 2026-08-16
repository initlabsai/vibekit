# Calling Smart Contracts Reference

## Contents

- [Initialize AlgorandClient](#initialize-algorandclient)
- [Get Account](#get-account)
- [Deploy with Factory Pattern (REQUIRED)](#deploy-with-factory-pattern-required)
- [Deploy with ABI Create Method (IMPORTANT)](#deploy-with-abi-create-method-important)
- [Get Existing Client by App ID](#get-existing-client-by-app-id)
- [Call Methods](#call-methods)
- [Passing Transaction Arguments](#passing-transaction-arguments)
- [Method Chaining with newGroup()](#method-chaining-with-newgroup)
- [Simulate for Read-Only Calls](#simulate-for-read-only-calls)
- [Struct Returns Are Tuples on Client Side](#struct-returns-are-tuples-on-client-side)
- [Box References in Method Calls](#box-references-in-method-calls)
- [Read State](#read-state)
- [Opt-In / Close-Out](#opt-in--close-out)
- [Delete Application](#delete-application)
- [Auto-Populating App Call Resources](#auto-populating-app-call-resources)
- [Auto-Covering Inner Transaction Fees](#auto-covering-inner-transaction-fees)
- [deploy-config.ts Pattern](#deploy-configts-pattern)
- [AlgoKit Utils Gotchas](#algokit-utils-gotchas)

TypeScript client patterns for contract deployment and interaction.

### Initialize AlgorandClient

```typescript
import { AlgorandClient } from '@algorandfoundation/algokit-utils'

// From environment (reads ALGORAND_* env vars)
const algorand = AlgorandClient.fromEnvironment()

// Explicit localnet
const algorand = AlgorandClient.defaultLocalNet()

// Explicit testnet
const algorand = AlgorandClient.testNet()

// Explicit mainnet
const algorand = AlgorandClient.mainNet()
```

### Get Account

```typescript
// From environment variable (e.g., DEPLOYER_MNEMONIC)
const account = await algorand.account.fromEnvironment('DEPLOYER')

// From mnemonic directly
const account = await algorand.account.fromMnemonic('word1 word2 ...')

// Localnet dispenser (auto-funded)
const dispenser = await algorand.account.localNetDispenser()
```

### Deploy with Factory Pattern (REQUIRED)

Always use the Factory pattern for deployment. Do NOT use `getTypedAppClientByCreatorAndName` for deploying.

```typescript
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
// In AlgoKit template projects: ./artifacts/<source_dir>/MyAppClient
// In devportal-code-examples: ./artifacts/clients/MyApp/MyAppClient
import { MyAppFactory } from './artifacts/clients/MyApp/MyAppClient'

const algorand = AlgorandClient.fromEnvironment()
const deployer = await algorand.account.fromEnvironment('DEPLOYER')

const factory = algorand.client.getTypedAppFactory(MyAppFactory, {
  defaultSender: deployer.addr,
})

const { appClient, result } = await factory.deploy({
  onUpdate: 'append',
  onSchemaBreak: 'append',
})

// Fund app account if newly created (e.g., for box storage)
if (['create', 'replace'].includes(result.operationPerformed)) {
  await algorand.send.payment({
    sender: deployer.addr,
    receiver: appClient.appAddress,
    amount: (1).algo(),
  })
}
```

### Deploy with ABI Create Method (IMPORTANT)

If the contract has an ABI `createApplication()` method (not bare create), you **must** specify `createParams`:

```typescript
// Contract has: @abimethod({ onCreate: 'require' })
//               public createApplication(admin: string): void { ... }

const { appClient, result } = await factory.deploy({
  onUpdate: 'append',
  onSchemaBreak: 'append',
  createParams: {
    method: 'createApplication',
    args: { admin: deployer.addr.toString() },
  },
})
```

Without `createParams`, factory.deploy does a **bare create** (no method call). If your contract requires an ABI method on create, you'll get `invalid ApplicationArgs index 0`. Check the generated client/factory file to see which create methods exist.

### Get Existing Client by App ID

```typescript
import { MyAppClient } from './artifacts/clients/MyApp/MyAppClient'

const client = algorand.client.getTypedAppClientById(MyAppClient, {
  appId: 1234n,
  defaultSender: account.addr,
})
```

### Call Methods

```typescript
// No arguments, no return
await client.send.myMethod({})

// With arguments
await client.send.setValue({ args: { value: 42n } })

// Get return value
const result = await client.send.getValue({})
console.log(result.return) // typed return value
```

### Passing Transaction Arguments

When a contract method takes a transaction parameter (e.g., `gtxn.PaymentTxn`), create the transaction and pass it as an arg:

```typescript
// Create the transaction (without sending)
const paymentTxn = await algorand.createTransaction.payment({
  sender: account.addr,
  receiver: appClient.appAddress,
  amount: (1).algo(),
})

// Pass it as a method argument
await client.send.myMethod({
  args: { payment: paymentTxn, otherArg: 42n },
})
```

### Method Chaining with `newGroup()`

Chain multiple method calls into a single atomic group:

```typescript
// Chain methods and send
await client.newGroup()
  .method1({ args: { value: 1n } })
  .method2({ args: { value: 2n } })
  .send()

// Chain methods and simulate (no fees, no signing)
const result = await client.newGroup()
  .method1({ args: { value: 1n } })
  .method2({ args: { value: 2n } })
  .simulate()
```

### Simulate for Read-Only Calls

Use `.simulate()` instead of `.send()` for read-only methods to avoid fees and signing:

```typescript
// Read-only: use simulate (free, no signature needed)
const result = await client.newGroup()
  .getCounter()
  .simulate()
const counterValue = result.returns[0]

// State-changing: use send (requires fees and signing)
await client.send.increment({ args: { amount: 1n } })
```

### Struct Returns Are Tuples on Client Side

When a contract method returns a struct type, the client receives it as a **tuple** (array), not an object. Destructure by field order:

```typescript
// Contract returns: type Listing = { seller: bytes; assetId: uint64; price: uint64 }
const result = await client.send.getListing({ args: { id: 1n } })

// CORRECT - destructure as tuple by field order
const [seller, assetId, price] = result.return as [string, bigint, bigint]

// INCORRECT - not an object
// const { seller, assetId, price } = result.return
```

### Box References in Method Calls

For simple named boxes, pass the key as a string. For BoxMap with non-string keys, you must construct the reference manually:

```typescript
// Simple box - string key
await client.send.setBox({
  args: { value: 42n },
  boxReferences: ['myBox'],
})

// BoxMap<uint64, T> with prefix 'map' - encode key manually
import { ABIUintType } from 'algosdk'

function createBoxReference(appId: bigint, prefix: string, key: bigint) {
  const uint64Type = new ABIUintType(64)
  const encodedKey = uint64Type.encode(key)
  const boxName = new Uint8Array([
    ...new TextEncoder().encode(prefix),
    ...encodedKey,
  ])
  return { appId, name: boxName }
}

await client.send.setMapValue({
  args: { key: 1n, value: 'Hello' },
  boxReferences: [createBoxReference(client.appId, 'map', 1n)],
})
```

**Alternative:** Use `populateAppCallResources: true` to auto-discover box references via simulate, avoiding manual construction.

### Read State

```typescript
// Global state - all keys
const globalState = await client.state.global.getAll()

// Global state - specific typed key
const count = await client.state.global.count()

// Local state for an address
const localState = await client.state.local(address).getAll()

// Box storage
const boxValue = await client.state.box.myBox()
```

### Opt-In / Close-Out

```typescript
// Opt-in with ABI method
await client.send.optIn.optIn({})

// Bare opt-in (no method call)
await client.send.optIn.bare({})

// Close-out with ABI method
await client.send.closeOut.closeOut({})

// Bare close-out
await client.send.closeOut.bare({})
```

### Delete Application

```typescript
// With ABI method
await client.send.delete.deleteApplication({})

// Bare delete
await client.send.delete.bare({})
```

---

## Auto-Populating App Call Resources (`populateAppCallResources`)

Automatically discovers and populates account, asset, app, and box references via simulate. Eliminates manual `boxReferences` in most cases.

### Per-Call

```typescript
await client.send.myMethod({
  args: { key: 1n },
  populateAppCallResources: true,
})
```

### Global Configuration

```typescript
import { Config } from '@algorandfoundation/algokit-utils'

Config.configure({
  populateAppCallResources: true,
})

// Now all calls auto-populate resources
await client.send.myMethod({ args: { key: 1n } })
```

**Note:** This uses simulate under the hood to discover required references. For performance-critical paths or when you know the exact references, pass them explicitly.

---

## Auto-Covering Inner Transaction Fees (`coverAppCallInnerTransactionFees`)

Automatically calculates the correct fee to cover inner transactions via simulate. Replaces manual `extraFee` calculations.

### Per-Call

```typescript
await client.send.transferWithInnerTxn({
  args: { receiver: bob.addr.toString(), amount: 1000n },
  coverAppCallInnerTransactionFees: true,
  maxFee: (0.01).algo(), // Required safety cap
})
```

### Global Configuration

```typescript
Config.configure({
  coverAppCallInnerTransactionFees: true,
})
```

### Manual Alternative (`extraFee`)

If you know the exact number of inner transactions:

```typescript
await client.send.transferWithInnerTxn({
  args: { receiver: bob.addr.toString(), amount: 1000n },
  extraFee: (0.001).algo(), // Cover 1 inner txn (1000 microAlgo)
})
```

**Important:** `coverAppCallInnerTransactionFees` only works with `addAppCallMethodCall()` in transaction groups, not with `addTransaction()`.

---

## deploy-config.ts Pattern

The standard deployment configuration file:

```typescript
// smart_contracts/deploy-config.ts
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { MyAppFactory } from './artifacts/clients/MyApp/MyAppClient'

export async function deploy() {
  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const factory = algorand.client.getTypedAppFactory(MyAppFactory, {
    defaultSender: deployer.addr,
  })

  const { appClient, result } = await factory.deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  // Fund app account if newly created
  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      sender: deployer.addr,
      receiver: appClient.appAddress,
      amount: (1).algo(),
    })
  }

  console.log(`App ID: ${appClient.appId}`)
  return appClient
}
```

---

## AlgoKit Utils Gotchas

### Amount Helpers

```typescript
import { algo, microAlgo } from '@algorandfoundation/algokit-utils'

algo(1)           // 1 Algo = 1,000,000 microAlgo
algo(0.5)         // 0.5 Algo = 500,000 microAlgo
microAlgo(1000)   // 1000 microAlgo

// Extension method syntax (alternative)
(1).algo()        // 1 Algo = 1,000,000 microAlgo
(100).microAlgo() // 100 microAlgo
```

### `algorandFixture` Default Funding

`algorandFixture()` funds each `testAccount` with **10 ALGO** by default. After deploy + app funding + MBR, you may not have much left. Use `testAccountFunding: algo(100)` if tests need more:

```typescript
const localnet = algorandFixture({
  testAccountFunding: algo(100),
})
```

### Address `.toString()` Gotcha (algosdk v3)

In algosdk v3, `account.addr` returns an `Address` object. Generated typed clients expect `string` for address arguments:

```typescript
// CORRECT - call .toString() for typed client args
await client.send.transfer({
  args: { receiver: bob.addr.toString(), amount: 100n },
})

// WRONG - Type 'Readonly<Address>' is not assignable to type 'string'
await client.send.transfer({
  args: { receiver: bob.addr, amount: 100n },  // TypeScript error
})

// For sender/receiver in AlgorandClient transactions, Address objects work directly
await algorand.send.payment({
  sender: alice.addr,    // Address object OK here
  receiver: bob.addr,    // Address object OK here
  amount: (1).algo(),
})
```
