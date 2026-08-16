---
name: algorand-core
description: Foundational mental model for the Algorand Virtual Machine (AVM). Use when encountering AVM concepts, stack machine questions, resource limit errors, opcode budget issues, program size problems, or constraint errors. Use when an agent defaults to PyTEAL, Beaker, or raw TEAL. Read BEFORE writing any smart contract code. Covers the two-type system (uint64/bytes), compilation from TypeScript/Python to TEAL, hard resource limits, and common LLM anti-patterns.
---

# Algorand Core: The AVM Mental Model

Read this before writing any contract code.

## The AVM Is Not What You Think

The AVM is a **stack machine** with two fundamental data types: `uint64` and `bytes`. No heap, no GC, no objects, no dynamic dispatch, no closures, no exceptions, no standard library.

When you write contracts in TypeScript or Python, you are **not** writing TypeScript or Python. You are writing AVM programs using TS/Python syntax. The Puya compiler translates a **strict subset** of the language into TEAL bytecode. Any feature that doesn't map to AVM operations fails at compile time.

## Types

At the AVM level, every value is `uint64` or `bytes` (max 4096 bytes). However, the SDKs and AVM provide richer abstractions:

**AVM reference types** — The AVM natively supports `Account`, `Asset`, and `Application` via dedicated opcodes (`acct_params_get`, `asset_holding_get`, `app_params_get`, etc.). These are passed to contracts via foreign arrays and resolved by index at runtime.

**ARC-4 encoded types** — The [ARC-4 ABI standard](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0004.md) defines high-level types encoded as `bytes`: `Bool`, `UInt8`–`UInt512`, `UFixedNxM` (fixed-point decimals), `String`, `DynamicBytes`, `Address`, `StaticArray`, `DynamicArray`, `Struct`, and `Tuple`. The SDKs provide these via the `arc4` module.

**SDK native types** — Both SDKs provide native types that compile to efficient AVM operations: `UInt64`/`uint64`, `Bytes`/`bytes`, `BigUInt`/`biguint`, `String`/`string`, `Account`, `Asset`, `Application`, `Boolean`/`bool`, plus storage types (`GlobalState`, `LocalState`, `Box`, `BoxMap`).

Use native types for internal logic (more efficient). Use ARC-4 types for ABI method parameters/returns, storage, and cross-contract interfaces. The compiler auto-converts between native and ARC-4 types at ABI boundaries.

## Compilation Pipeline

```
Algorand TypeScript (.algo.ts)  ──┐
                                  ├──→  Puya Compiler  ──→  TEAL  ──→  AVM Bytecode
Algorand Python (algopy)        ──┘
```

Contract code (`.algo.ts` / `algopy` modules) compiles to TEAL. Test/deploy code is normal TS/Python. Never mix these — see [language-subset-model.md](./references/language-subset-model.md).

## Critical Limits

| Resource            | Limit                          | Notes                                                                  |
| ------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| Opcode budget       | 700 per app call               | Pooled across group (max 11,200; up to 190,400 with inner txn pooling) |
| Program size        | 2048 bytes per page            | Max 4 pages = 8192 bytes total                                         |
| Transaction group   | 16 transactions                | Atomic — all succeed or all fail                                       |
| Inner transactions  | 256 pooled across group        | Max depth 8 levels                                                     |
| Global state        | 64 key-value pairs             | Key + value ≤ 128 bytes combined                                       |
| Local state         | 16 key-value pairs per account | Key + value ≤ 128 bytes combined                                       |
| Box storage         | 32,768 bytes per box           | MBR: 2,500 + 400 × (name + value length) µAlgo; 2,048 bytes I/O per box ref |
| Log output          | 32 calls, 1024 bytes total     | Per app call                                                           |
| Min transaction fee | 1000 microAlgo                 | Fee pooling within groups                                              |

Full limits with MBR formulas: [avm-resource-limits.md](./references/avm-resource-limits.md)

## Rules

- **NEVER use PyTEAL, Beaker, or raw TEAL** — use Algorand TypeScript or Algorand Python
- **Two fundamental types** — `uint64` and `bytes` at the AVM level; SDKs provide higher-level abstractions (ARC-4 types, reference types) that compile down to these
- **Hard limits are hard** — no clever code bypasses opcode budget or program size limits
- **No re-entrancy** — applications cannot call themselves, even indirectly through inner transactions
- **Contract code is not normal code** — `.algo.ts` / `algopy` compiles to TEAL; test/deploy files are normal TS/Python
- **Read the language skill next** — `algorand-typescript` or `algorand-python` for syntax and patterns

## Reference Guide

| Topic           | File                                                              | When to Read                                          |
| --------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| Execution model | [avm-execution-model.md](./references/avm-execution-model.md)     | How programs run, budget pooling, program structure   |
| Resource limits | [avm-resource-limits.md](./references/avm-resource-limits.md)     | Hitting limits, planning storage, MBR calculations    |
| Language subset | [language-subset-model.md](./references/language-subset-model.md) | Compiler errors, "can I use X?", compilation boundary |
| LLM mistakes    | [common-llm-mistakes.md](./references/common-llm-mistakes.md)     | Debugging, code review, avoiding anti-patterns        |
