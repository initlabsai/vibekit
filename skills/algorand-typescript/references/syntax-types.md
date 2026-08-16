# AVM Types and Value Semantics

## Basic AVM Types

| Type | Description | Constructor |
|------|-------------|-------------|
| `uint64` | 64-bit unsigned integer | `Uint64()` |
| `bytes` | Byte array | `Bytes()` |
| `bytes<N>` | Fixed-size byte array (e.g., `bytes<32>`) | `Bytes()` |
| `biguint` | Up to 512-bit unsigned integer | `BigUint` |
| `string` | UTF-8 string | Native strings |
| `bool` | Boolean | `true`/`false` |

## Type Mappings

AVM types don't map to JavaScript primitives:
- JavaScript `number` is signed and unbounded; AVM `uint64` is 64-bit unsigned
- JavaScript `Uint8Array`/`ArrayBuffer` don't exist; use `bytes`

## Objects and Arrays

**Plain TypeScript objects** are supported and mutable:
```typescript
type Point = { x: uint64; y: uint64 }
```

**Plain TypeScript arrays** are supported and mutable:
```typescript
const values: uint64[] = []
const items: Array<uint64> = []
```

**Prefer native types over ARC4**: Plain objects and arrays are more efficient for computations and mutations than `arc4.StaticArray`, `arc4.DynamicArray`, `arc4.Struct`.

## Numbers (CRITICAL)

**Const literals work.** Constant `number` and `bigint` literals are accepted:

```typescript
// CORRECT - const literals
const x = 123          // OK: const number literal
const y = x * 500      // OK: const expression
const a = 2n ** 128n   // OK: const bigint literal
```

**Mutable variables need explicit types.** The danger is *inference* — `let` and mutable expressions may infer as `number`:

```typescript
// CORRECT - explicit uint64 type
const amount: uint64 = Uint64(20)
let total: uint64 = amount + Uint64(100)
const timeout: uint64 = Global.latestTimestamp + timeoutSeconds

// INCORRECT - infers as number, compiler error
let amount = 20
let total = amount + 100
const timeout = Global.latestTimestamp + timeoutSeconds
```

**Bare `0` and small literals in typed contexts:** When a parameter or field already has a `uint64` type, bare integer literals like `0` are accepted as arguments:

```typescript
// OK - parameter type is known to be uint64
itxn.assetTransfer({ assetAmount: 0, fee: 0 })  // 0 is fine here
itxn.payment({ amount: Uint64(100_000), fee: 0 })

// STILL INCORRECT for variable declarations
let amount = 0  // infers as number — use let amount: uint64 = Uint64(0)
```

**Rule of thumb:** Always use explicit `uint64` type annotations for mutable variables and computed results. Bare integer literals are fine as arguments to typed parameters.

## String Operations

`string.length` is NOT supported. Use equality checks:

```typescript
// CORRECT
assert(text !== '', 'Text cannot be empty')

// INCORRECT - Compiler error
assert(text.length > 0, 'Text cannot be empty')
assert(text.length <= 200, 'Text too long')
```

## Value Semantics — `clone()` Rules (CRITICAL)

The AVM uses value semantics. Mutable types (structs, arrays, objects) in storage
**must** be explicitly copied with `clone()`. Without it:
`error: cannot create multiple references to a mutable stack type`

### Decision Table

| Operation | clone()? | Example |
|-----------|----------|---------|
| Read complex type from storage | YES | `const d = clone(this.box(k).value)` |
| Write complex type to storage | YES | `this.box(k).value = clone(d)` |
| Read/write primitive from storage | NO | `const n = this.counter.value` |
| Create NEW object literal | NO | `const item: T = { id: Uint64(1) }` |
| Copy local variable (mutable type) | YES | `const copy = clone(original)` |
| Iterate array from storage | YES | `for (const x of clone(items))` |
| Put array into object for storage | YES | `{ todos: clone(arr) }` |

### Common Mistakes

```typescript
// INCORRECT — read from BoxMap without clone (COMPILER ERROR)
const escrow = this.escrows(escrowId).value
escrow.status = Uint64(1)
this.escrows(escrowId).value = escrow

// CORRECT — clone on read AND write
const escrow = clone(this.escrows(escrowId).value)
escrow.status = Uint64(1)
this.escrows(escrowId).value = clone(escrow)
```

```typescript
// INCORRECT — clone() on a new object literal (unnecessary)
const newItem = clone<Item>({ id: nextId, name: text })

// CORRECT — assign new object literals directly
const newItem: Item = { id: nextId, name: text }
this.items(key).value = clone(newItem)  // clone when STORING
```

```typescript
import { clone } from '@algorandfoundation/algorand-typescript'
```

**Exception**: Primitive types (`uint64`, `bytes`, `string`, `bool`) stored directly
(not in structs) do NOT require `clone()`.

## Union Types (Not Supported)

Cannot use union types like `Item | null` or `string | uint64`:

```typescript
// CORRECT - Use boolean flags
let found = false
let foundItem: Item = { /* default values */ }
for (const item of clone(items)) {
  if (matches(item)) {
    foundItem = clone(item)
    found = true
    break
  }
}
assert(found, 'Item not found')
return foundItem

// INCORRECT - Compiler error
let foundItem: Item | null = null
let value: string | uint64 = someValue
```

## Array Operations

- **AVOID**: `forEach` — use `for...of`
- **AVOID**: `splice` on dynamic arrays — opcode-heavy
- **PREFER**: `FixedArray<uint64, N>` for fixed-size mutable arrays (native type)
- **USE**: `arc4.StaticArray<arc4.UInt64, N>` only when ARC-4 encoding is needed
- **AVOID**: Nested dynamic types (`uint64[][]`) — encode as tuples

**Critical array rules**:
- Functions cannot mutate passed arrays
- Cannot specify array lengths with square brackets (`number[10]` invalid)
- Arrays in object literals must be cloned: `{ todos: clone(array) }`
- Clone arrays before iterating: `for (const item of clone(array))`
- Loop indices must be `uint64`, not `number`:

```typescript
let index = Uint64(0)
for (const item of clone(array)) {
  // use index
  index = index + Uint64(1)
}
```

## Unavailable APIs

These JavaScript APIs are NOT supported (AVM constraints):
- `Uint8Array` / `ArrayBuffer`
- Object methods (`.keys()`, `.values()`, etc.)
- Array length via square brackets
- Standard JavaScript APIs
