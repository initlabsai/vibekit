# Methods, ABI, and Lifecycle

## Contents

- [Method Visibility](#method-visibility)
- [Decorator Syntax](#decorator-syntax)
- [Application Lifecycle Methods](#application-lifecycle-methods)
- [ABI Return Types](#abi-return-types)
- [Type Definitions](#type-definitions)
- [Generated Client Method Names](#generated-client-method-names)
- [Events (ARC-28)](#events-arc-28)
- [`assertMatch` for Validation](#assertmatch-for-validation)

## Method Visibility

By default, `@abimethod` decorators are NOT necessary. Visibility determines ABI exposure:

| Visibility | Behavior |
|------------|----------|
| `public` | Automatically exposed as ABI method |
| `private` | Becomes subroutine (internal only) |

```typescript
// Public = ABI method automatically
public addTodo(text: string): uint64 { }

// Private = subroutine
private getTodoKey(account: bytes, todoId: uint64): string { }

// Decorator only when needed for config
@abimethod({ readonly: true })
public getData(): [uint64, uint64, uint64] { }
```

**When to use `@abimethod()`**: Only when you need configuration like `{ readonly: true }`, `{ allowActions: 'OptIn' }`, etc.

**Transaction-type parameters**: Methods can require group transactions (e.g., `gtxn.PaymentTxn`) as parameters — see [syntax-transactions.md § As ABI Method Parameters](./syntax-transactions.md#as-abi-method-parameters).

### `@readonly` Shorthand

Use `@readonly` as a standalone decorator instead of `@abimethod({ readonly: true })`:

```typescript
import { readonly } from '@algorandfoundation/algorand-typescript/arc4'

// These are equivalent:
@readonly
public getCounter(): uint64 { return this.counter.value }

@abimethod({ readonly: true })
public getCounter(): uint64 { return this.counter.value }
```

## Decorator Syntax

ARC4 decorators MUST be called as functions with parentheses:

```typescript
// CORRECT
@abimethod()
public update(): string { }

// INCORRECT - "Decorator function return type mismatch"
@arc4.abimethod
public update(): string { }
```

## Application Lifecycle Methods

**PREFER convention-based methods** for lifecycle events. They are automatically routed based on OnCompletion action.

| Method Name | When Called |
|-------------|-------------|
| `createApplication()` | Application creation |
| `optInToApplication()` | OnCompletion is OptIn |
| `closeOutOfApplication()` | OnCompletion is CloseOut |
| `updateApplication()` | OnCompletion is UpdateApplication |
| `deleteApplication()` | OnCompletion is DeleteApplication |

```typescript
export class TodoList extends Contract {
  todos = LocalState<TodoListData>({ key: 'todos' })

  // Convention-based: automatically routed on OptIn
  public optInToApplication(): void {
    const initialList = {
      todos: [] as Todo[],
      nextId: Uint64(1),
    }
    this.todos(Txn.sender).value = clone(initialList)
  }

  // Regular ABI methods for business logic
  public addTodo(text: string): uint64 {
    // ...
  }
}
```

## ABI Return Types

Struct objects can be returned directly. Puya converts to ABI tuples automatically:

```typescript
// CORRECT: Return struct directly
@abimethod({ readonly: true })
public getData(): MyData {
  const state = clone(this.appState.value)
  return state  // Compiler converts to ABI tuple
}

// ALSO CORRECT: Return tuple explicitly
@abimethod({ readonly: true })
public getData(): [uint64, uint64, uint64] {
  const state = clone(this.appState.value)
  return [state.field1, state.field2, state.field3]
}
```

## Type Definitions

Use plain TypeScript types for storage, not ARC4 decorators:

```typescript
// CORRECT
type MyData = { field1: uint64; field2: uint64 }

// INCORRECT
@arc4.abiTuple class MyData { }
```

## Generated Client Method Names

### Convention-based Lifecycle Methods

Convention-based methods like `optInToApplication()` are nested under their action type in generated clients:

```typescript
// Contract
public optInToApplication(): void { }

// Client call
await client.send.optIn.optInToApplication({ args: [] })
```

### Decorator-based Opt-in Methods

Methods with `@abimethod({ allowActions: 'OptIn' })` are also nested:

```typescript
// Contract
@abimethod({ allowActions: 'OptIn' })
public optIn(): void { }

// CORRECT - nested under optIn
await client.send.optIn.optIn({ args: [] })

// INCORRECT
await client.send.optIn({ args: [] })
```

**Recommendation**: Use convention-based `optInToApplication()` for better readability. Always check the generated client file to confirm exact method names.

## Events (ARC-28)

Emit events using `emit()` for off-chain indexing:

```typescript
import { emit } from '@algorandfoundation/algorand-typescript'

type TransferEvent = { from: Account; to: Account; amount: uint64 }

export class MyToken extends Contract {
  public transfer(to: Account, amount: uint64): void {
    // ... transfer logic ...
    emit<TransferEvent>('Transfer', { from: Txn.sender, to, amount })
  }
}
```

Events are logged with an ARC-28 prefix and can be parsed from transaction logs by indexers and explorers.

## `assertMatch` for Validation

Validate multiple properties at once instead of multiple `assert()` calls:

```typescript
import { assertMatch } from '@algorandfoundation/algorand-typescript'

// Equality checks
assertMatch(payment, {
  sender: expectedSender,
  receiver: Global.currentApplicationAddress,
})

// Comparison operators (numeric fields only)
assertMatch(payment, {
  amount: { greaterThanEq: minAmount },
})
```

### Comparison Operators

**Numeric fields** (`uint64`, `biguint`):

| Operator | Meaning | Example |
|----------|---------|---------|
| (direct value) | `===` | `{ amount: exactAmount }` |
| `greaterThan` | `>` | `{ amount: { greaterThan: min } }` |
| `greaterThanEq` | `>=` | `{ amount: { greaterThanEq: min } }` |
| `lessThan` | `<` | `{ amount: { lessThan: max } }` |
| `lessThanEq` | `<=` | `{ amount: { lessThanEq: max } }` |
| `between` | inclusive range | `{ amount: { between: [min, max] } }` |
| `not` | `!==` | `{ status: { not: Uint64(0) } }` |

**Non-numeric fields** (`Account`, `bytes`, etc.): only direct value or `{ not: value }`.

```typescript
// INCORRECT — these operator names do NOT exist
assertMatch(payment, { amount: { greaterThanEqualTo: min } })
assertMatch(payment, { amount: { gte: min } })

// CORRECT
assertMatch(payment, { amount: { greaterThanEq: min } })
```

`assertMatch` works with `Txn`, group transactions (`gtxn.*`), and any typed object.
Also available: `match()` — same API but returns `boolean` instead of asserting.
