# Language Subset Model

You are writing AVM programs in TypeScript/Python syntax. The Puya compiler translates a strict subset into TEAL opcodes. If a feature doesn't map to AVM operations, it won't compile.

## What the AVM Does NOT Have

| Missing Feature         | Implication                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| Heap / dynamic memory   | No `new`, no dynamic arrays, no growing collections               |
| Floating-point numbers  | Use fixed-point math (multiply by 10^n)                           |
| Signed integers         | Check `a > b` before `a - b` to avoid underflow                   |
| Null / undefined / None | Use `.exists` checks on state, or `maybe()` pattern               |
| Objects / classes       | Use ARC-4 structs (compile to byte-encoded tuples)                |
| Dynamic dispatch        | All call targets resolved at compile time                         |
| Closures / lambdas      | Use module-level functions only                                   |
| Recursion               | Use loops instead (no call stack)                                 |
| Exceptions / try-catch  | `assert` fails the entire program; validate inputs first          |
| Async / await           | Synchronous execution only                                        |
| Standard library        | No `Math`, `Array.map`, `json`, `re` — use AVM opcodes            |
| String manipulation     | `bytes` only — use `Bytes`, `String` from SDK                     |
| Generics (custom)       | Only SDK-provided generics work (`BoxMap<K,V>`, `GlobalState<T>`) |
| npm/pip imports         | Only `@algorandfoundation/algorand-typescript` or `algopy`        |

## What DOES Compile

| Feature                                      | Notes                                            |
| -------------------------------------------- | ------------------------------------------------ |
| Integer arithmetic (`+`, `-`, `*`, `/`, `%`) | Unsigned `uint64`, overflow fails                |
| Byte operations (`concat`, `extract`, `len`) | Max 4096 bytes per value                         |
| Comparison and boolean operators             | Standard `==`, `!=`, `<`, `>`, `&&`, `\|\|`, `!` |
| If/else, for/while loops                     | Watch opcode budget with large iterations        |
| Functions (`callsub`/`retsub`)               | No recursion, no closures                        |
| ARC-4 structs and arrays                     | Fixed-layout byte-encoded tuples                 |
| Global/Local state, Box storage              | Key-value with size limits                       |
| Inner transactions                           | Create txns from within contracts                |
| ABI methods                                  | Standard contract interfaces                     |
| Constants and type assertions                | Compiled inline / compile-time only              |

## Key Restrictions

### Numbers

- **TypeScript:** `uint64` type, `Uint64()` constructor. Never use `number` or `bigint` in contracts.
- **Python:** `UInt64` from `algopy`. Never use Python `int` for on-chain values.
- No negatives, no floats. Overflow fails. Division truncates.

### Strings and Bytes

- **TypeScript:** `string` / `bytes` (AVM types). Not JavaScript `String`.
- **Python:** `String` / `Bytes` from `algopy`. Not Python `str` / `bytes`.
- Max 4096 bytes per value. No regex, no Unicode processing.

### Data Structures

- No `Map`, `Set`, `dict`, `list`. Use `BoxMap` for key-value, `StaticArray`/`DynamicArray` for sequences.
- **TypeScript:** Must `clone()` complex types before mutation — value semantics, not reference semantics.

## The Compilation Boundary

|              | Contract Code                  | Client / Test / Deploy Code  |
| ------------ | ------------------------------ | ---------------------------- |
| **Files**    | `.algo.ts` / `algopy` modules  | Regular `.ts` / `.py` files  |
| **Runtime**  | AVM (on-chain)                 | Node.js / Python (off-chain) |
| **Language** | Strict subset                  | Full language                |
| **Types**    | `uint64`, `bytes`, ARC-4 types | Any type                     |
| **Imports**  | SDK only                       | Any package                  |

**Never mix these.** Contract code cannot import npm/pip packages. Client code cannot use AVM types directly. The typed client (from ARC-56 app spec) bridges the boundary.
