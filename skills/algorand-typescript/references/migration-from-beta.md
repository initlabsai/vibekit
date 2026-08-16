# Migrating Algorand TypeScript Beta to 1.0

## Breaking Changes

### Object literals - add `readonly` or `as const` if immutability needed

Object literals are now mutable by default. For immutability, use `Readonly<>` or `as const`:

```ts
// Mutable (new default)
const p1: Point = { x: 1, y: 2 };
p1.x = 3; // Now allowed

// Immutable (opt-in)
type ImmutablePoint = Readonly<{ y: uint64; x: uint64 }>;
const p2 = { x: Uint64(1), y: Uint64(2) } as const;
```

### Native arrays - add `readonly` or `as const` if immutability needed

Native arrays are now mutable by default. For immutability:

```ts
const t1: uint64[] = [1, 2, 3];
t1[0] = 3; t1.push(4); // Now allowed

// Immutable
const t2: readonly uint64[] = [1, 2, 3];
const t3 = [Uint64(1), Uint64(2), Uint64(3)] as const;
```

### Rename `MutableArray` to `ReferenceArray`

```ts
// Beta: MutableArray<uint64>()
// 1.0:
const a = new ReferenceArray<uint64>();
```

### Replace `xxx.copy()` calls with `clone(xxx)`

```ts
// Beta: const b = a.copy()
// 1.0:
import { clone } from '@algorandfoundation/algorand-typescript';
const b = clone(a);
```

> Also applies to TEALScript migration — see [migration-from-tealscript.md](./migration-from-tealscript.md#use-clone-for-copies).

### Remove 'N' and 'NxM' suffixes from ARC4 numeric types

```ts
// Beta                          →  1.0
arc4.UintN16                     →  arc4.Uint16
arc4.UintN<16>                   →  arc4.Uint<16>
arc4.UFixedNxM<32, 4>           →  arc4.UFixed<32, 4>
new arc4.UintN<16>(1234)         →  new arc4.Uint<16>(1234)
new arc4.UFixedNxM<32, 4>('..') →  new arc4.UFixed<32, 4>('..')
```

### Update `gtxn` and `itxn` imports

```ts
// Beta: import type { PaymentTxn } from '@algorandfoundation/algorand-typescript/gtxn'
// 1.0:
import type { gtxn } from '@algorandfoundation/algorand-typescript';
function makePayment(payment: gtxn.PaymentTxn) { /* ... */ }
```

### Update resource encoding

`resourceEncoding: 'index' | 'value'` option added to `@abimethod` with `value` as default.

```ts
// Beta behavior (index encoding) — to keep, add explicit option:
@abimethod({ resourceEncoding: 'index' })
test(asset: Asset, app: Application, acc: Account) { /* ... */ }

// New default (value encoding) — no change needed:
test(asset: Asset, app: Application, acc: Account) {
  const assetId = op.btoi(Txn.applicationArgs(1));
  assert(asset === Asset(assetId)); // Passed by value
}
```

### Rename test files

Rename `.(spec|test).ts` → `.algo.(spec|test).ts` for files that import from `algorand-typescript` or `algorand-typescript-testing`.

### Rename `arc4EncodedLength` to `sizeOf`

```ts
// Beta: arc4EncodedLength<uint64>()
// 1.0:
import { sizeOf } from '@algorandfoundation/algorand-typescript';
sizeOf<uint64>(); // 8
```

### Update `abiCall` syntax

```ts
// Beta: arc4.abiCall(Hello.prototype.greet, { appId: 1234, args: ['abi'] })
// 1.0 (method property):
arc4.abiCall({ method: Hello.prototype.greet, appId: app, args: ['abi'] });
// 1.0 (type argument — supports type-only imports):
arc4.abiCall<typeof HelloStubbed.prototype.greet>({ appId: app, args: ['stubbed'] });
```

### Rename `interpretAsArc4` to `convertBytes`

```ts
// Beta: arc4.interpretAsArc4<arc4.UintN<32>>(someBytes)
// 1.0:
arc4.convertBytes<arc4.Uint<32>>(someBytes, { strategy: 'validate' });
arc4.convertBytes<arc4.Byte>(someBytes, { prefix: 'log', strategy: 'unsafe-cast' });
```

### Replace `BoxRef` with `Box<bytes>`

```ts
// Beta: BoxRef({ key: 'test_key' })
// 1.0:
const box = Box<bytes>({ key: 'test_key' });
box.create({ size: 32768 });
box.value = Bytes('FOO');          // was box.put()
box.resize(Uint64(6));
const extracted = box.extract(Uint64(0), Uint64(3));  // args now Uint64
box.resize(extracted.length);      // was extracted.size
```

### Replace `.native` property

```ts
// Beta: z.native (for all sizes)
// 1.0 — use size-appropriate method:
const z = new arc4.Uint<8>(n);
z.asUint64();   // For types ≤64 bits

const a = new arc4.Uint<128>(b);
a.asBigUint();  // For types >64 bits
```
