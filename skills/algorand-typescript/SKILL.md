---
name: algorand-typescript
description: Develops Algorand smart contracts in TypeScript using Algorand TypeScript (PuyaTs). Covers contract syntax, AVM types, storage patterns, transactions, ABI methods, testing, deployment, and AlgoKit Utils. Use when: (1) writing or modifying .algo.ts smart contracts, (2) using uint64, bytes, GlobalState, BoxMap, LocalState, itxn, gtxn in contracts, (3) testing contracts with algorandFixture/Vitest, (4) deploying or calling contracts with typed clients, (5) migrating from TEALScript or Algorand TypeScript beta, (6) troubleshooting Puya compiler errors or AVM transaction errors, (7) using AlgorandClient, AppFactory, or generated app clients in TypeScript.
---

# Algorand TypeScript

Write, test, deploy, and troubleshoot Algorand TypeScript smart contracts.

## Quick Start

```bash
algokit init -n my-project -t typescript --answer preset_name production --defaults
cd my-project
algokit project run build    # Compile .algo.ts → ARC-56 + typed client
algokit project run test     # Run Vitest tests
algokit localnet start       # Start local network
algokit project deploy localnet  # Deploy
```

## Critical Rules

- **File extension**: Contract files MUST use `.algo.ts`
- **NEVER use `number`**: Use `uint64` and `Uint64()` for all numeric values in contracts
- **Always `clone()` storage reads/writes**: `clone(this.box(k).value)` — see syntax-types.md decision table
- **`fee: Uint64(0)` on all inner transactions**: Prevents app account drain; caller covers via fee pooling
- **Fund app account before box operations**: Box storage requires MBR funding
- **NEVER use PyTEAL, Beaker, or raw TEAL**: Only use Algorand TypeScript (PuyaTs)
- **Always search docs first**: Use Kapa MCP or web search before writing contract code
- **Always include tests**: Use `algorandFixture` for E2E integration tests
- **Understand AVM constraints**: See `algorand-core` skill for the foundational mental model

## Reference Guide

Read the specific reference file for your task. Each file is self-contained.

### Contract Syntax

- [syntax-types.md](./references/syntax-types.md) — AVM types (`uint64`, `bytes`, `bigint`), number rules, `clone()`, value semantics, union type workarounds, array rules
- [syntax-storage.md](./references/syntax-storage.md) — `GlobalState`, `LocalState`, `BoxMap`, `Box`, MBR funding patterns, `@contract` decorator for dynamic keys, choosing storage types
- [syntax-methods.md](./references/syntax-methods.md) — Method visibility (`public`/`private`), `@abimethod`/`@readonly` decorators, transaction-type parameters, lifecycle methods, `emit()` events, `assertMatch` with comparison operators
- [syntax-transactions.md](./references/syntax-transactions.md) — `gtxn` typed access, ABI method transaction parameters, `itxn` inner transactions, `itxnCompose`/`itxn.submitGroup`, fee pooling, asset creation

### Testing

- [testing.md](./references/testing.md) — E2E test examples (HelloWorld, BoxStorage, LocalStorage, StructInBox) + unit testing with `TestExecutionContext`

### Deployment and Client Interaction

- [deploy-interaction.md](./references/deploy-interaction.md) — Factory deployment, typed client calls, `newGroup()` chaining, `.simulate()`, struct-as-tuple returns, box references, `populateAppCallResources`, `coverAppCallInnerTransactionFees`, amount helpers, `.addr.toString()` gotcha

### Migration

- [migration-from-tealscript.md](./references/migration-from-tealscript.md) — TEALScript → Algorand TypeScript 1.0 migration with 13 changes
- [migration-from-beta.md](./references/migration-from-beta.md) — Beta → 1.0 migration with 13 breaking changes

### Troubleshooting

- [errors.md](./references/errors.md) — Contract errors (assert, opcode budget, box MBR, inner txn) + transaction errors (overspend, asset not opted in, account not found)

## Canonical Example Repos

Search these repositories for real-world code examples:

- **`algorandfoundation/devportal-code-examples`** — Primary examples in `projects/typescript-examples/contracts/` (HelloWorld, BoxStorage, LocalStorage, StructInBox, etc.)
- **`algorandfoundation/puya-ts`** — Compiler examples in `examples/` (hello_world_arc4, voting, amm)
- **`algorandfoundation/algokit-typescript-template`** — AlgoKit project template
- **`algorandfoundation/algokit-utils-ts`** — AlgoKit Utils TypeScript SDK

## Cross-References

- **New to Algorand?** Read `algorand-core` skill first for AVM mental model
- **Project scaffolding and CLI**: See `algorand-project-setup` skill
- **React frontends**: See `algorand-frontend` skill
