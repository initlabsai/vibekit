---
name: algorand-python
description: Develops Algorand smart contracts in Python using PuyaPy — covers syntax, decorators, storage, transactions, types, testing with pytest, deployment, AlgoKit Utils, ARC-4/ARC-56 standards, and error troubleshooting. Use when writing algopy contracts, using @arc4.abimethod decorators, working with GlobalState or BoxMap in Python, testing with AlgorandClient, deploying or calling contracts from Python, or diagnosing PuyaPy compiler and transaction errors.
---

# Algorand Python

Write, test, deploy, and troubleshoot Algorand Python smart contracts.

## Quick Start

```bash
# Create Python project
algokit init -n my-project -t python --answer preset_name production --defaults

# Development cycle
cd my-project
algokit project run build    # Compile contracts with PuyaPy
algokit project run test     # Run pytest tests
algokit localnet start       # Start local network
algokit project deploy localnet  # Deploy
```

## Critical Rules

- **Understand AVM constraints first** — see `algorand-core` skill for the foundational mental model
- **NEVER use PyTEAL or Beaker** — use Algorand Python (PuyaPy) with `algopy` imports
- **Use `@arc4.abimethod`** for public ABI methods, `@arc4.baremethod` for bare calls
- **Always search docs first** — use Kapa MCP or web search before writing contract code
- **Always include tests** — use pytest with AlgoKit Utils
- **Fund app account before box operations** — box storage requires MBR funding
- **Always `.copy()` mutable values** — call `.copy()` when appending to or storing mutable types: ARC-4 (`arc4.Struct`, `arc4.DynamicArray`) and native (`algopy.Array`, `algopy.FixedArray`, `algopy.Struct`)

## Reference Guide

Read the specific reference file for your task. Each file is self-contained.

### Contract Syntax

- [syntax-types.md](./references/syntax-types.md) — AVM types (`arc4.UInt64`, `arc4.String`, `Bytes`, `UInt64`), ARC-4 encoding, native vs ARC-4 conversions
- [syntax-storage.md](./references/syntax-storage.md) — `GlobalState`, `LocalState`, `Box`, `BoxMap`, `BoxRef`, MBR funding patterns
- [syntax-methods.md](./references/syntax-methods.md) — `@arc4.abimethod`, `@arc4.baremethod`, `@subroutine`, lifecycle methods, visibility, `ARC4Contract` vs `Contract`
- [syntax-transactions.md](./references/syntax-transactions.md) — Inner transactions (`itxn`), group transactions, fee pooling

### Testing

- [testing.md](./references/testing.md) — Pytest patterns, `AlgorandClient` setup, typed client testing, box funding, multi-user tests

### Deployment and Client Interaction

- [deploy-interaction.md](./references/deploy-interaction.md) — CLI commands, typed client factory, method calls, state reading, `AlgorandClient` API, accounts, transactions, groups, amount helpers

### Troubleshooting

- [errors.md](./references/errors.md) — Contract errors (assert, opcode budget, box MBR, inner txn) + transaction errors (overspend, asset not opted in, account not found)

## Canonical Example Repos

Search these repositories for real-world code examples:

- **`algorandfoundation/devportal-code-examples`** — Primary examples in `projects/python-examples/smart_contracts/` (HelloWorld, BoxStorage, etc.)
- **`algorandfoundation/puya`** — Compiler examples in `examples/` (hello_world_arc4, voting, amm)
- **`algorandfoundation/algokit-python-template`** — AlgoKit project template
- **`algorandfoundation/algokit-utils-py`** — AlgoKit Utils Python SDK

## Cross-References

- **New to Algorand?** Read `algorand-core` skill first for AVM mental model
- **Project scaffolding and CLI**: See `algorand-project-setup` skill
- **React frontends**: See `algorand-frontend` skill
