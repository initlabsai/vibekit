---
name: build-on-algorand
description: Build and review TypeScript-only Algorand applications using the AVM, PuyaTs, generated clients, tests, browser wallets, and relevant ARCs. Use for contracts, assets and tokens, client or frontend integration, defensive implementation, migrations, and x402 orientation. Excludes structured security audits and finding reports, Python, project lifecycle, LocalNet, accounts, deployment operations, and VibeKit extension development.
---

# Build on Algorand

Build Algorand applications with TypeScript on both sides of the compilation
boundary:

- **Contract TypeScript** is the restricted Algorand TypeScript language that
  PuyaTs compiles for the AVM. It is not general JavaScript.
- **Client TypeScript** runs off-chain and uses generated clients, AlgoKit Utils,
  algosdk, and wallet signers.

Preserve that boundary. Never copy off-chain libraries, asynchronous code, or
ordinary JavaScript data models into a contract.

## Start with the project

Read `AGENTS.md`, `package.json`, compiler configuration, and existing contract
and generated-client patterns before changing code. Use the project's pinned
dependencies and npm scripts. Do not introduce Python or the AlgoKit CLI, and
do not replace the project's stack or add a dependency when its existing tools
cover the task.

When working in a VibeKit-configured project, load `use-vibekit` for project
lifecycle, LocalNet, accounts, signing, network selection, deployment, and
on-chain operations. This skill covers the application code and design.

## Choose the guide

| Task | Guide |
| --- | --- |
| Reason about applications, Logic Signatures, execution budgets, resources, fees, or protocol capabilities | [AVM fundamentals](references/avm-fundamentals.md) |
| Write or review Algorand TypeScript contract types, methods, control flow, or ABI surfaces | [PuyaTs contracts](references/puyats-contracts.md) |
| Choose state, use boxes, inspect group transactions, or emit inner transactions | [State and transactions](references/state-and-transactions.md) |
| Generate or consume typed clients, test contracts, simulate calls, or debug failures | [Clients and testing](references/clients-and-testing.md) |
| Connect a browser wallet or pass a wallet signer to a generated client | [Frontend wallets](references/frontend-wallets.md) |
| Harden an implementation or perform an ordinary contract-safety review | [Security](references/security.md) |
| Move from TEALScript, Algorand TypeScript beta, ARC-32, or older client APIs | [Migrations](references/migrations.md) |
| Select an application, ASA, token, NFT, event, or multisig ARC | [Standards](references/standards.md) |
| Orient a TypeScript client or resource server to x402 on Algorand | [x402](references/x402.md) |

Load only the references needed for the current task.

Load `audit-algorand` for a structured vulnerability assessment, threat model,
exploit analysis, mainnet-readiness review, or security finding report. This
skill remains the owner of implementation and routine defensive review.

## Contract invariants

- Do not use the TypeScript `number` type in contract code. Use AVM-native
  types such as `uint64`, `biguint`, and `bytes`, or explicit ARC-4 types.
  Numeric literals still need an AVM type from context or a constructor.
- Treat arrays, objects, byte strings, storage, and arithmetic according to
  PuyaTs semantics. Use `clone(value)` when an independent array or object is
  required.
- Prefer ARC-4 ABI methods and an ARC-56 application specification for public
  applications and generated clients. Accept ARC-32 only where existing tools
  or artifacts require it.
- Validate every relevant field of transaction arguments. A transaction's
  group position or type alone does not prove its sender, receiver, amount,
  asset, application, close address, or rekey target.
- Account for opcode budget, program size, transaction fees, app-call
  resources, box I/O budget, and minimum-balance changes during design.
- Make update, delete, opt-in, close-out, and clear-state behavior explicit.
  Default-deny lifecycle actions the application does not need.
- Compile and test the generated TEAL behavior. Use `simulate` for execution
  traces and fee/resource diagnosis; do not use removed `dryrun` or `tealdbg`
  workflows.

## Canonical starting points

- [Smart-contract overview](https://dev.algorand.co/concepts/smart-contracts/overview/)
- [Algorand TypeScript language guide](https://dev.algorand.co/concepts/smart-contracts/languages/typescript/)
- [PuyaTs examples](https://github.com/algorandfoundation/puya-ts/tree/main/examples)
- [PuyaTs devportal examples](https://github.com/algorandfoundation/puya-ts/tree/main/examples/devportal)
- [AlgoKit Utils TypeScript examples](https://github.com/algorandfoundation/algokit-utils-ts/tree/docs-staging/examples)
- [ARC repository](https://github.com/algorandfoundation/ARCs/tree/main/ARCs)

Material adapted from an upstream MIT-licensed skill set is documented in
[Attribution](ATTRIBUTION.md).
