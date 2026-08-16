# Smart Contract & Transaction Errors

Common errors when building, deploying, or calling Algorand smart contracts.

## Table of Contents

- [Logic Eval Errors](#logic-eval-errors)
  - [Assert Failed](#assert-failed)
  - [Opcode Budget Exceeded](#opcode-budget-exceeded)
  - [Invalid Program](#invalid-program)
  - [Stack Underflow](#stack-underflow)
  - [Byte/Int Type Mismatch](#byteint-type-mismatch)
- [ABI Errors](#abi-errors)
  - [Method Not Found](#method-not-found)
  - [ABI Encoding Error](#abi-encoding-error)
  - [Return Value Decoding Error](#return-value-decoding-error)
- [State Errors](#state-errors)
  - [Global State Full](#global-state-full)
  - [Local State Not Opted In](#local-state-not-opted-in)
  - [Box Not Found](#box-not-found)
  - [Box MBR Not Met](#box-mbr-not-met)
- [Inner Transaction Errors](#inner-transaction-errors)
- [Transaction & Account Errors](#transaction--account-errors)
  - [Overspend](#overspend)
  - [Asset Not Opted In](#asset-not-opted-in)
  - [Account Not Found](#account-not-found)
  - [Not Opted Into Application](#not-opted-into-application)
- [Debugging Tips](#debugging-tips)

## Logic Eval Errors

### Assert Failed

```
logic eval error: assert failed pc=123
```

**Cause:** An `assert` statement evaluated to false.

**Debug with source maps (AlgoKit Utils):**

```typescript
try {
  await appClient.send.myMethod({ args: { value: 0n } })
} catch (e) {
  // Error includes source location automatically with ARC-56 source maps
  // e.g.: "assert failed at contracts/MyContract.algo.ts:45"
  console.error(e)
}
```

**Common causes:**
- Input validation failed (e.g., `assert(amount > Uint64(0))`)
- Authorization check failed (e.g., `assert(Txn.sender === this.owner.value)`)
- State precondition not met (e.g., `assert(this.isInitialized.value)`)

**Fix:** Check the assertion condition and ensure inputs satisfy it.

### Opcode Budget Exceeded

```
logic eval error: dynamic cost budget exceeded
```

**Cause:** Contract exceeded the 700 opcode budget per app call.

**Budget limits:** 700 per app call, poolable to 11,200 (16 app calls). See [avm-resource-limits.md](../../algorand-core/references/avm-resource-limits.md) for full details.

**Solutions:**

1. **Pool budget with extra app calls (client-side):**
```typescript
// Add dummy app calls to increase budget
await algorand.newGroup()
  .addAppCallMethodCall({
    sender: account.addr,
    appClient: client,
    method: 'expensiveMethod',
    args: [arg1],
  })
  .addAppCall({
    sender: account.addr,
    appId: client.appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    args: [new Uint8Array([0])], // Dummy call for budget
  })
  .send()
```

2. **Optimize expensive operations (contract-side):**
```typescript
// EXPENSIVE - iteration over large data
for (const item of clone(items)) {
  process(item)
}

// CHEAPER - use Box storage for large data
const boxData = Box<bytes>({ key: 'data' })
```

3. **Split across multiple calls (contract-side):**
```typescript
// Instead of one large operation, split into phases
public processPhase1(): void { /* ... */ }
public processPhase2(): void { /* ... */ }
```

### Invalid Program

```
logic eval error: invalid program
```

**Cause:** The TEAL program is malformed or uses unsupported opcodes.

**Common causes:**
- Compiling for wrong AVM version
- Using opcodes not supported on target network
- Corrupted approval/clear program bytes

**Fix:** Ensure compilation targets the correct AVM version.

### Stack Underflow

```
logic eval error: stack underflow
```

**Cause:** Operation tried to pop from empty stack.

**In Algorand TypeScript:** This usually indicates a bug in low-level operations. Check any `op.*` calls.

### Byte/Int Type Mismatch

```
logic eval error: assert failed: wanted type uint64 but got []byte
```

**Cause:** Wrong type passed to an operation.

**Common in Algorand TypeScript:**
```typescript
// INCORRECT - comparing bytes to uint64
assert(payment.amount === someBytes)

// CORRECT - Use proper types
assert(payment.amount === Uint64(1_000_000))
```

## ABI Errors

### Method Not Found

```
error: method "foo(uint64)void" not found
```

**Cause:** Calling a method that doesn't exist in the contract ABI.

**Fix:**
1. Regenerate the typed client after contract changes (`algokit project run build`)
2. Check the method signature matches exactly
3. Verify the contract was deployed with the latest code

### ABI Encoding Error

```
ABIEncodingError: value out of range for uint64
```

**Cause:** Value doesn't fit the ABI type.

**Examples:**
```typescript
// INCORRECT - Negative value for uint64
-1n // uint64 cannot be negative

// INCORRECT - Value too large for uint8
256n // arc4.UInt8 max is 255

// CORRECT - Use appropriate types
0n   // Valid uint64
256n // Use arc4.UInt16 for values > 255
```

### Return Value Decoding Error

```
error: could not decode return value
```

**Cause:** Method returned unexpected data format.

**Common causes:**
- Contract didn't log the return value properly
- Wrong return type in client
- Transaction failed before return

**Fix:** Check contract method has correct return type annotation.

## State Errors

### Global State Full

```
logic eval error: store global state: failed
```

**Cause:** Exceeded declared global state schema.

**Fix:** If using dynamic keys, declare totals with `@contract` decorator:
```typescript
@contract({ stateTotals: { globalUints: 5, globalBytes: 3 } })
export class MyContract extends Contract {
  // Dynamic state access requires declared totals
}
```

### Local State Not Opted In

```
logic eval error: application APPID not opted in
```

**Cause:** Account hasn't opted into the application.

**Fix:** Opt in before accessing local state:
```typescript
// Using typed client
await client.send.optIn.optInToApplication({})

// Or using AlgorandClient directly
await algorand.send.appCall({
  sender: userAddress,
  appId: appId,
  onComplete: algosdk.OnApplicationComplete.OptInOC,
})
```

### Box Not Found

```
logic eval error: box not found
```

**Cause:** Accessing a box that doesn't exist.

**Fix:** Create box before access or check existence (contract-side):
```typescript
// In contract - check if box exists
if (this.myBox.exists) {
  const value = clone(this.myBox.value)
} else {
  this.myBox.value = clone(defaultValue)
}
```

### Box MBR Not Met

```
logic eval error: box create with insufficient funds
```

**Cause:** App account lacks funds for box minimum balance requirement.

**MBR formula:** `2500 + (400 * (key_length + value_length))` microAlgos per box

**Fix:** Fund the app account (client-side):
```typescript
await algorand.send.payment({
  sender: funder.addr,
  receiver: appClient.appAddress,
  amount: (1).algo(), // Cover box MBR
})
```

## Inner Transaction Errors

### Insufficient Balance for Inner Txn

```
logic eval error: insufficient balance
```

**Cause:** App account lacks funds for inner transaction amount.

**Fix:** Fund the app account before calling methods with inner transactions:
```typescript
await algorand.send.payment({
  sender: deployer.addr,
  receiver: appClient.appAddress,
  amount: (5).algo(),
})
```

### Inner Transaction Limit

```
logic eval error: too many inner transactions
```

**Cause:** Exceeded 256 inner transactions per group.

**Fix:** Split operations across multiple outer transactions.

### App Not Opted Into Asset

```
logic eval error: asset ASSET_ID not opted in
```

**Cause:** Contract account isn't opted into the asset.

**Fix:** Add opt-in method to contract:
```typescript
// Contract-side
public optInToAsset(asset: Asset): void {
  itxn.assetTransfer({
    xferAsset: asset,
    assetReceiver: Global.currentApplicationAddress,
    assetAmount: Uint64(0),
    fee: Uint64(0),
  }).submit()
}
```

Call from client:
```typescript
await client.send.optInToAsset({
  args: { asset: assetId },
  coverAppCallInnerTransactionFees: true,
  maxFee: (0.002).algo(),
})
```

## Transaction & Account Errors

### Overspend

```
TransactionPool.Remember: transaction TXID: overspend (account ADDRESS, data {_struct:{} Status:Offline MicroAlgos:{Raw:1000} ...})
```

**Cause:** Sender account has insufficient balance for amount + fee + minimum balance.

See [avm-resource-limits.md](../../algorand-core/references/avm-resource-limits.md) for MBR formulas.

**Fix:** Fund the sender account or account for MBR when calculating available balance:
```typescript
const accountInfo = await algorand.account.getInformation(address)
const available = accountInfo.balance.microAlgo - accountInfo.minBalance.microAlgo
```

### Asset Not Opted In

```
asset ASSET_ID missing from ACCOUNT_ADDRESS
```

**Cause:** Receiving account hasn't opted into the asset.

**Fix:** Opt in before transfer:
```typescript
await algorand.send.assetOptIn({
  sender: receiver.addr,
  assetId: assetId,
})
```

### Account Not Found

```
account ADDRESS not found
```

**Cause:** Account doesn't exist (never funded). Algorand accounts must receive at least minimum balance to exist.

**Fix:** Fund the account:
```typescript
await algorand.send.payment({
  sender: funder.addr,
  receiver: newAccount.addr,
  amount: microAlgo(100_000), // Minimum
})
```

### Not Opted Into Application

```
address ADDRESS has not opted in to application APPID
```

**Cause:** Account trying to access local state without opt-in.

**Fix:**
```typescript
// Using typed client
await client.send.optIn.optInToApplication({})

// Or using AlgorandClient
await algorand.send.appCall({
  sender: user.addr,
  appId: appId,
  onComplete: algosdk.OnApplicationComplete.OptInOC,
})
```

## Debugging Tips

### Simulate to Get Execution Trace

```typescript
const result = await algorand.newGroup()
  .addAppCallMethodCall(params)
  .simulate({ execTraceConfig: { enable: true } })

console.log(result.simulateResponse.txnGroups[0].txnResults[0].execTrace)
```

ARC-56 source maps automatically map `pc=N` to source locations in error messages.

## References

- [Debugging Smart Contracts](https://dev.algorand.co/concepts/smart-contracts/debugging/)
- [AVM Opcodes Reference](https://dev.algorand.co/reference/teal/opcodes/)
- [Error Handling in AlgoKit](https://dev.algorand.co/algokit/utils/typescript/debugging/)

> **See also:** `algorand-core` skill ([avm-resource-limits.md](../../algorand-core/references/avm-resource-limits.md)) for complete AVM limits, MBR formulas, and budget pooling details.
