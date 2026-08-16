# Storage Patterns

## Contents

- [Storage Types Overview](#storage-types-overview)
- [Storage Access Patterns](#storage-access-patterns)
- [Box Storage MBR (CRITICAL)](#box-storage-mbr-critical)
- [Choosing Storage Type](#choosing-storage-type)
- [Dynamic State Keys and `@contract` Decorator](#dynamic-state-keys-and-contract-decorator)
- [Class Properties](#class-properties)

## Storage Types Overview

| Storage | Scope | Who Pays MBR | Use Case |
|---------|-------|--------------|----------|
| `GlobalState` | App-wide | App account | Shared app data |
| `LocalState` | Per-user | User (on opt-in) | Per-user data with opt-in |
| `Box` | App-wide | App account | Large data, single key |
| `BoxMap` | Per-key | App account | Per-user data without opt-in |

## Storage Access Patterns

### GlobalState

```typescript
import { GlobalState, clone } from '@algorandfoundation/algorand-typescript'

export class MyContract extends Contract {
  appState = GlobalState<MyData>({ key: 'state' })

  public updateState(amount: uint64): void {
    const state = clone(this.appState.value)
    const updated = clone(state)
    updated.counter = updated.counter + amount
    this.appState.value = clone(updated)
  }
}
```

### LocalState (Requires Opt-in)

```typescript
import { LocalState, Txn, clone } from '@algorandfoundation/algorand-typescript'

export class MyContract extends Contract {
  userData = LocalState<UserData>({ key: 'user' })

  public optInToApplication(): void {
    const initial: UserData = { balance: Uint64(0) }
    this.userData(Txn.sender).value = clone(initial)
  }

  public getBalance(): uint64 {
    return clone(this.userData(Txn.sender).value).balance
  }
}
```

### BoxMap (No Opt-in Required)

```typescript
import { BoxMap, Account, clone } from '@algorandfoundation/algorand-typescript'

export class MyContract extends Contract {
  userBoxes = BoxMap<Account, UserData>({ keyPrefix: 'u' })

  public createUser(user: Account): void {
    const initial: UserData = { balance: Uint64(0) }
    this.userBoxes(user).value = clone(initial)
  }
}
```

### BoxMap Operations

```typescript
// Set value
this.userBoxes(user).value = clone(data)

// Read value
const data = clone(this.userBoxes(user).value)

// Check existence
if (this.userBoxes(user).exists) { /* ... */ }

// Delete entry (frees MBR)
this.userBoxes(user).delete()
```

The same `.exists` and `.delete()` methods work on `Box` and `BoxMap`.

### BoxMap with Composite Keys

BoxMap supports object types as keys:

```typescript
export class MyContract extends Contract {
  // Composite key: two uint64 fields
  balances = BoxMap<{ assetId: uint64; accountId: uint64 }, uint64>({ keyPrefix: 'b' })

  public setBalance(assetId: uint64, accountId: uint64, amount: uint64): void {
    this.balances({ assetId, accountId }).value = amount
  }
}
```

### Box with Tuple Values

Boxes can store tuple types:

```typescript
export class MyContract extends Contract {
  metadata = Box<[string, bytes]>({ key: 'meta' })

  public setMetadata(name: string, data: bytes): void {
    this.metadata.value = [name, data]
  }
}
```

## Box Storage MBR (CRITICAL)

Box storage increases the app account's Minimum Balance Requirement (MBR). The app account must be funded BEFORE boxes can be created.

### MBR Formula

```
(2500 per box) + (400 * (box size + key size)) microAlgos per box
```

### Funding Pattern in deploy-config.ts

```typescript
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { MyAppFactory } from '../artifacts/my_app/MyAppClient'

export async function deploy() {
  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const factory = algorand.client.getTypedAppFactory(MyAppFactory, {
    defaultSender: deployer.addr,
  })

  const { appClient, result } = await factory.deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append'
  })

  // MANDATORY: Fund app account if BoxMap is used
  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: (1).algo(),  // Fund app account for box MBR
      sender: deployer.addr,
      receiver: appClient.appAddress,
    })
  }
}
```

**Note**: `operationPerformed` values are `'create'`, `'replace'`, `'update'`, or `'append'`. Only fund on `'create'` or `'replace'` to avoid redundant funding.

### Testing with BoxMap

E2E tests using BoxMap require app account funding before first box operation:

```typescript
// Fund immediately after deployment in test setup
const { client } = await deploy(testAccount)

await localnet.algorand.send.payment({
  amount: (1).algo(),
  sender: testAccount,
  receiver: client.appAddress,
})

// Now box operations will work
await client.send.createUser({ args: [userAccount] })
```

## Choosing Storage Type

| Scenario | Recommended | Reason |
|----------|-------------|--------|
| Per-user data, user pays | `LocalState` | User covers MBR on opt-in |
| Per-user data, app pays | `BoxMap` | No opt-in needed, app funds MBR |
| Shared app config | `GlobalState` | Simple, always available |
| Large data (>128 bytes) | `Box` or `BoxMap` | No size limits like GlobalState |

## Dynamic State Keys and `@contract` Decorator

When using dynamic keys for `GlobalState` or `LocalState` (keys not known at compile time), you **must** declare state totals with the `@contract` decorator:

```typescript
import { contract, Contract, GlobalState } from '@algorandfoundation/algorand-typescript'

@contract({ stateTotals: { globalUints: 10, globalBytes: 5, localUints: 3, localBytes: 2 } })
export class MyContract extends Contract {
  // Fixed key: auto-counted by compiler
  counter = GlobalState<uint64>({ key: 'counter' })

  // Dynamic keys: need stateTotals to reserve slots
  public setDynamic(key: string, value: uint64): void {
    const state = GlobalState<uint64>({ key })
    state.value = value
  }
}
```

Without `@contract({ stateTotals })`, the compiler only counts fixed-key declarations. Dynamic keys will fail at runtime with "store global state: failed".

## Class Properties

Cannot define class properties or constants. Only storage proxies allowed on contract classes:

```typescript
// CORRECT: Module-level constants
const MAX_ITEMS: uint64 = Uint64(100)

class MyContract extends Contract {
  items = GlobalState<ItemList>({ key: 'items' })  // OK: storage proxy

  public addItem(): void {
    // Use MAX_ITEMS here
  }
}

// INCORRECT: Class properties
class MyContract extends Contract {
  private readonly MAX_ITEMS: uint64 = Uint64(100)  // Compiler error
}
```

> **See also:** `algorand-core` skill ([avm-resource-limits.md](../../algorand-core/references/avm-resource-limits.md)) for complete MBR formulas and storage size limits.
