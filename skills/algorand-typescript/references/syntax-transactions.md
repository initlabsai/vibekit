# Group and Inner Transactions

## Contents

- [Group Transactions (gtxn)](#group-transactions-gtxn)
- [Inner Transactions (itxn)](#inner-transactions-itxn)
- [Inner Transaction Result Properties](#inner-transaction-result-properties)
- [Asset Type](#asset-type)
- [Complete Example: Escrow Release](#complete-example-escrow-release)

## Group Transactions (gtxn)

Access group transactions using typed `gtxn` functions with `uint64` indices:

```typescript
import { gtxn, Global, Uint64 } from '@algorandfoundation/algorand-typescript'

// Verify group size
assert(Global.groupSize === Uint64(3), 'Must be group of 3 transactions')

// Access group transactions using typed functions
const assetTransfer = gtxn.AssetTransferTxn(Uint64(0))  // First transaction
const payment = gtxn.PaymentTxn(Uint64(1))              // Second transaction

// Verify transaction properties
assert(assetTransfer.sender.bytes === sellerBytes, 'Asset must come from seller')
assert(assetTransfer.assetReceiver.bytes === buyer.bytes, 'Asset must go to buyer')
assert(assetTransfer.xferAsset === asset, 'Asset ID mismatch')
assert(payment.amount === listing.price, 'Payment amount mismatch')
```

**INCORRECT**: `const txn = gtxn[0]` — array indexing doesn't work.

### Available Typed Functions

| Function | Transaction Type |
|----------|------------------|
| `gtxn.PaymentTxn(n)` | Payment |
| `gtxn.AssetTransferTxn(n)` | Asset transfer |
| `gtxn.AssetConfigTxn(n)` | Asset configuration |
| `gtxn.ApplicationCallTxn(n)` | Application call |
| `gtxn.AssetFreezeTxn(n)` | Asset freeze |
| `gtxn.KeyRegistrationTxn(n)` | Key registration |
| `gtxn.Transaction(n)` | Untyped access |

### As ABI Method Parameters

Methods can require transactions in the group by declaring `gtxn` type parameters. The ARC4 router automatically maps the preceding group transaction:

```typescript
import { Contract, Global, assert, gtxn } from '@algorandfoundation/algorand-typescript'

class Escrow extends Contract {
  buy(payment: gtxn.PaymentTxn, item: uint64): void {
    // Verify payment goes to this app
    assert(payment.receiver === Global.currentApplicationAddress)
    assert(payment.amount >= this.price.value)
    // Process purchase...
  }
}
```

**Caller side:** Create the transaction and pass it as an arg to the typed client:

```typescript
const paymentTxn = await algorand.createTransaction.payment({
  sender: buyer.addr,
  receiver: appClient.appAddress,
  amount: (1).algo(),
})

await client.send.buy({
  args: { payment: paymentTxn, item: 42n },
})
```

See [deploy-interaction.md](./deploy-interaction.md) for more details on passing transaction arguments.

## Inner Transactions (itxn)

### Method Selector Helper

Use `methodSelector` to get the 4-byte ARC-4 method selector for inner app calls:

```typescript
import { methodSelector } from '@algorandfoundation/algorand-typescript/arc4'

// Get selector from method signature
const selector = methodSelector('transfer(address,uint64)void')

// Use in inner app call
itxn.applicationCall({
  appId: targetApp,
  appArgs: [selector, encodedArg1, encodedArg2],
  fee: Uint64(0),
}).submit()
```

### Method Names

Inner transaction methods use **lowercase**:

```typescript
import { itxn, Global, Uint64 } from '@algorandfoundation/algorand-typescript'

// CORRECT - lowercase
itxn.payment({ ... }).submit()
itxn.assetTransfer({ ... }).submit()

// INCORRECT
itxn.Payment({ ... })  // Wrong case
```

### Application Address

Use `Global.currentApplicationAddress`, not `this.appAddress()`:

```typescript
// CORRECT
assert(payment.receiver.bytes === Global.currentApplicationAddress.bytes)

// INCORRECT
assert(payment.receiver.bytes === this.appAddress().bytes)
```

### Account from Bytes

When storing Account as bytes and converting back for inner transactions:

```typescript
// Store Account as bytes (required for GlobalState/BoxMap)
const escrow = clone(this.escrow.value)
const sellerBytes = escrow.seller  // bytes stored in state

// Convert bytes to Account for inner transaction
itxn.payment({
  receiver: Account(sellerBytes),  // Convert bytes to Account
  amount: escrow.amount,
  fee: Uint64(0),
}).submit()
```

### Asset Creation via Inner Transaction

Use `itxn.assetConfig` to create assets (e.g., NFTs) from within a contract:

```typescript
// Create an NFT (total=1, decimals=0)
const createTxn = itxn.assetConfig({
  total: Uint64(1),
  decimals: Uint64(0),
  assetName: name,
  unitName: unitName,
  url: url,
  manager: Global.currentApplicationAddress,
  reserve: Global.currentApplicationAddress,
  fee: Uint64(0),
}).submit()

// The new asset ID is available from the result
const newAssetId = createTxn.createdAsset.id
```

**CRITICAL LIMITATION:** You **cannot** create an asset and transfer it to the caller (`Txn.sender`) in the same method call. The caller hasn't opted into the asset (which doesn't exist until mid-execution), and opt-in can't happen mid-execution. Design patterns:
- The contract holds the created asset; a separate method transfers it after the caller opts in
- The caller opts in first (to a known asset ID range), then the contract creates and transfers

### App Account Asset Opt-In

Apps must opt into assets before receiving them. Opt-in is a zero-amount self-transfer:

```typescript
public optInToAsset(asset: Asset): void {
  itxn.assetTransfer({
    xferAsset: asset,
    assetReceiver: Global.currentApplicationAddress,
    assetAmount: Uint64(0),
    fee: Uint64(0),
  }).submit()
}
```

**Requirements:**
- App account needs 100,000 microAlgo MBR per opted-in asset
- Fund the app account before calling this method
- Call from client with `coverAppCallInnerTransactionFees: true`

### Fee Pooling (CRITICAL)

Always set `fee: Uint64(0)` for inner transactions. The app call sender covers fees through fee pooling:

```typescript
itxn.payment({
  receiver: Account(sellerBytes),
  amount: escrow.amount,
  fee: Uint64(0),  // Caller covers fees
}).submit()
```

This prevents app account drain attacks where malicious callers force the app to pay fees.

**Caller side:** Use `coverAppCallInnerTransactionFees: true` or `extraFee: (0.001).algo()` when calling methods with inner transactions. See [deploy-interaction.md](./deploy-interaction.md) for details.

### Composing Multiple Inner Transactions

Use `itxnCompose` for submitting multiple inner transactions atomically:

```typescript
import { itxn, itxnCompose, Global, Account, Uint64 } from '@algorandfoundation/algorand-typescript'

// Submit multiple inner transactions as a group
itxnCompose.begin(
  itxn.payment({
    receiver: Account(recipientBytes),
    amount: Uint64(100_000),
    fee: Uint64(0),
  })
)

itxnCompose.next(
  itxn.assetTransfer({
    xferAsset: assetId,
    assetReceiver: Account(recipientBytes),
    assetAmount: Uint64(50),
    fee: Uint64(0),
  })
)

itxnCompose.submit()
```

**Note**: `itxnCompose.begin()` stages the first transaction in a new group, `itxnCompose.next()` stages subsequent transactions, and `itxnCompose.submit()` sends them all atomically.

### Fixed-Size Groups with `itxn.submitGroup`

For known-size groups, prefer `itxn.submitGroup` for typed return access:

```typescript
import { itxn } from '@algorandfoundation/algorand-typescript'

// Submit a fixed group — returns typed results
const [payResult, assetResult] = itxn.submitGroup(
  itxn.payment({
    receiver: Account(recipientBytes),
    amount: Uint64(100_000),
    fee: Uint64(0),
  }),
  itxn.assetTransfer({
    xferAsset: assetId,
    assetReceiver: Account(recipientBytes),
    assetAmount: Uint64(50),
    fee: Uint64(0),
  }),
)

// Access typed results
const paidAmount = payResult.amount
const transferredAsset = assetResult.xferAsset
```

**When to use which:**
- `itxn.submitGroup()` — Known number of transactions at compile time. Gives typed return values.
- `itxnCompose` — Dynamic number of transactions (e.g., built in a loop).

## Inner Transaction Result Properties

### Payment Result
| Property | Type | Description |
|----------|------|-------------|
| `amount` | `uint64` | Payment amount |
| `receiver` | `Account` | Payment receiver |
| `sender` | `Account` | Transaction sender |

### Asset Config Result
| Property | Type | Description |
|----------|------|-------------|
| `createdAsset` | `Asset` | Newly created asset |
| `configAsset` | `Asset` | Configured asset |

### Asset Transfer Result
| Property | Type | Description |
|----------|------|-------------|
| `assetAmount` | `uint64` | Amount transferred |
| `assetReceiver` | `Account` | Asset receiver |
| `xferAsset` | `Asset` | Transferred asset |

### Application Call Result
| Property | Type | Description |
|----------|------|-------------|
| `createdApp` | `Application` | Newly created application |
| `lastLog` | `bytes` | Last log entry |
| `logs(n)` | `bytes` | Log entry at index |

## Asset Type

`Asset` constructor takes `uint64` directly:

```typescript
// CORRECT
const asset = Asset(assetId)  // if assetId is already uint64
const asset = Asset(Uint64(123))

// INCORRECT
const asset = Asset(123)  // number literal
const asset = Asset({ id: 123 })  // object
```

## Complete Example: Escrow Release

```typescript
import { 
  itxn, gtxn, Global, Account, Uint64, assert, clone 
} from '@algorandfoundation/algorand-typescript'

public releaseEscrow(): void {
  const escrow = clone(this.escrowData.value)
  
  // Verify the payment came to app
  assert(Global.groupSize === Uint64(2), 'Expected 2 txns')
  const payment = gtxn.PaymentTxn(Uint64(0))
  assert(
    payment.receiver.bytes === Global.currentApplicationAddress.bytes,
    'Payment must go to app'
  )
  
  // Send funds to seller via inner transaction
  itxn.payment({
    receiver: Account(escrow.seller),
    amount: escrow.amount,
    fee: Uint64(0),  // Fee pooling
  }).submit()
}
```
