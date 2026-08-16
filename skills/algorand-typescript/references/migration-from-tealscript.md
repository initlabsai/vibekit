# Migrating TEALScript to Algorand TypeScript 1.0

## Contents

- [Type Migration Table](#type-migration-table)
- [Migrations](#migrations)

## Type Migration Table

| TEALScript | Algorand TypeScript 1.0 |
|------------|------------------------|
| `EventLogger` | `emit` function |
| `BoxKey` | `Box` |
| `Txn` | `Transaction` |
| `PayTxn` | `PaymentTxn` |
| `AppCallTxn` | `ApplicationCallTxn` |
| `KeyRegTxn` | `KeyRegistrationTxn` |
| `OnCompletion` | `OnCompleteAction` |
| `ecAdd`, `ecMultiply`, etc. | `ElipticCurve.add`, `ElipticCurve.multiply` |
| `GlobalStateKey` | `GlobalState` |
| `LocalStateKey` | `LocalState` |
| `GlobalStateMap` | Not yet supported |
| `LocalStateMap` | Not yet supported |
| `isOptedInToApp`, `isOptedInToAsset` | `isOptedIn` |
| `this.txn` | `Txn` |
| `this.app` | `Global.currentApplicationAddress` |
| `verify...Txn` | `assertMatch` |
| `globals` | `Global` |
| `StaticArray` | `FixedArray` |
| `AppID` | `Application` |
| `AssetID` | `Asset` |
| `Address` | `Account` |
| `throw Error('msg')` | `err('msg')` |

## Migrations

### Add explicit imports

TEALScript injects types into global namespace. Algorand TypeScript requires explicit imports.

```ts
// TEALScript: types available globally, logic() method
// 1.0:
import { LogicSig, Txn, assert, uint64, TemplateVar } from '@algorandfoundation/algorand-typescript';

class AppCaller extends LogicSig {
  program(): boolean {               // logic() → program(), must return boolean
    assert(Txn.applicationId.id === 1234);
    return true;
  }
}
```

### Replace `EventLogger` with `emit()`

```ts
// TEALScript: this.swap = new EventLogger<{...}>(); this.swap.log({...})
// 1.0:
type Swap = { assetA: uint64; assetB: uint64 };

class Swapper extends Contract {
  doSwap(a: uint64, b: uint64): void {
    emit('swap', { assetA: a, assetB: b } as Swap);
  }
}

// Alternative: infer event name from type
type swap = { assetA: uint64; assetB: uint64 };
emit<swap>({ assetA: a, assetB: b });
```

### Update box creation syntax

`box.create(size)` → `box.create({ size })`. Size is auto-determined for fixed-length types in both.

### Refactor inner transactions

**Single transaction:**
```ts
// TEALScript: sendAssetConfig({ total: 1000, ... })
// 1.0:
const assetParams = itxn.assetConfig({
  total: 1000, assetName: 'AST1', unitName: 'unit', decimals: 3,
  manager: Global.currentApplicationAddress,
  reserve: Global.currentApplicationAddress,
});
const asset_txn = assetParams.submit();
log(asset_txn.createdAsset.id);
```

**Transaction group:**
```ts
// TEALScript: this.pendingGroup.addAssetCreation({...}); this.lastInnerGroup[0]
// 1.0:
const assetParams = itxn.assetConfig({ /* ... */ });
const appCreateParams = itxn.applicationCall({ /* ... */ });
const [appCreateTxn, asset3_txn] = itxn.submitGroup(appCreateParams, assetParams);
```

### Replace `sendMethodCall` with `arc4.abiCall`

```ts
// TEALScript: sendMethodCall<typeof Hello.prototype.greet>({ applicationID: app, methodArgs: ['algo dev'] })
// 1.0 (type argument):
const result = arc4.abiCall<typeof HelloStubbed.prototype.greet>({
  appId: 1234, args: ['algo dev'],
}).returnValue;

// 1.0 (method property):
const result2 = arc4.abiCall({
  method: Hello.prototype.greet, appId: 1234, args: ['algo dev'],
}).returnValue;
```

### Use `arc4.compileArc4()` for app creation

```ts
// TEALScript: Greeter.approvalProgram(), Greeter.schema.global.numUint, etc.
// 1.0:
const compiled = arc4.compileArc4(Greeter);

const app = arc4.abiCall({
  method: compiled.call.createApplication,
  args: ['hello'],
  globalNumUint: compiled.globalUints,
}).itxn.createdApp;

const result = arc4.abiCall({
  method: compiled.call.greet, args: ['world'], appId: app,
}).returnValue;
```

### Replace static methods with `compileArc4()`

```ts
// TEALScript: Greeter.clearProgram(), Greeter.approvalProgram(), Greeter.schema.global.numUint
// 1.0:
const compiled = arc4.compileArc4(Greeter);
compiled.clearStateProgram; compiled.approvalProgram; compiled.globalUints;
```

### Update logic sigs

```ts
// TEALScript: logic(amt: uint64) { assert(this.txn.amount === amt) }
// 1.0:
class DangerousPaymentLsig extends LogicSig {
  program() {
    const amt = op.btoi(op.arg(0));   // Use op.arg() for arguments
    return Txn.amount === amt;         // Must return boolean or uint64
  }
}
```

### Move template variables

```ts
// TEALScript: APP_ID = TemplateVar<AppID>() inside class
// 1.0: move outside class, explicit type + name
const APP_ID = TemplateVar<uint64>('APP_ID');

class AppCaller extends LogicSig {
  program(): boolean {
    assert(Txn.applicationId.id === APP_ID);
    return true;
  }
}
```

### Add explicit type annotations

TEALScript allows implicit `number` types. Algorand TypeScript requires explicit `uint64`.

```ts
// TEALScript: const sum = a + b (type inferred)
// 1.0:
const sum: uint64 = a + b; // Type required
```

### Replace typed literals with `arc4.Uint` constructors

```ts
// TEALScript: const one: uint256 = 1; const sum = n + one
// 1.0: use biguint for intermediate arithmetic
const one = 1n;
const sum: biguint = n.asBigUint() + one;
return new arc4.Uint<256>(sum);
```

**Best practice**: Use `biguint` for intermediate values, convert to `arc4.Uint` only when encoding.

### Replace `as` type casts

```ts
// TEALScript: return n as uint8
// 1.0:
return new arc4.Uint<8>(n); // Use constructor
```

### Use `clone()` for array and object copies

TEALScript allows mutable references. Algorand TypeScript requires explicit copies.

```ts
// TEALScript: const b = a (same reference)
// 1.0:
import { clone, assertMatch } from '@algorandfoundation/algorand-typescript';
const b = clone(a); // Explicit copy
b.push(4);
assertMatch(a, [1, 2, 3]);     // Original unchanged
assertMatch(b, [1, 2, 3, 4]);  // Copy modified
```
