# AVM fundamentals

Use this guide when design depends on what an Algorand program can observe,
change, or afford.

## Execution model

Algorand has two AVM program shapes:

- An **application** has an application ID and account, can keep state, receive
  app calls, inspect available ledger resources, log values, and issue inner
  transactions.
- A **Logic Signature** approves a transaction or delegates signing under a
  constrained stateless program. It does not provide application storage.

Applications run as part of an atomic transaction group. If any transaction or
program fails, the group fails. On-chain code has no network, filesystem,
threads, promises, clock APIs, floating point, or arbitrary package imports.
It sees only AVM values, transaction fields, declared/available resources, and
ledger data exposed by AVM operations.

Start with the [smart-contract overview](https://dev.algorand.co/concepts/smart-contracts/overview/)
and [AVM overview](https://dev.algorand.co/concepts/smart-contracts/avm/).

## Design against budgets

Before implementing a design, account for:

- opcode cost and pooled group budget;
- compiled program size and extra program pages;
- stack and byte-value limits;
- application arguments, logs, inner transactions, and group size;
- global/local state schema and account opt-in requirements;
- box references, box I/O budget, box size, and box minimum balance;
- foreign accounts, assets, applications, and other app-call resources;
- transaction and inner-transaction fees.

Do not freeze numeric limits into general guidance. Read the current
[costs and constraints](https://dev.algorand.co/concepts/smart-contracts/costs-constraints/)
and [resource usage](https://dev.algorand.co/concepts/smart-contracts/resource-usage/)
pages when a design is near a boundary.

## Protocol 5.0 implications

Protocol 5.0 introduced AVM v13, larger size-priced transactions and
applications, `poseidon2`, application-parameter mutation, new box parameter
and foreign-box operations, and variable-length branches. It also removed the
old `dryrun` endpoint and `tealdbg` tool in favor of simulation.

Use those capabilities only when the project's compiler and target network
support them. Larger limits do not remove fee, resource, or minimum-balance
costs. Diagnose transaction-size surcharges and inner-fee shortfalls with
`simulate`.

AVM v13 also salts programs automatically to avoid on-curve Logic Signature
hashes. After changing the target AVM version, regenerate and re-review a
Logic Signature's compiled address or bytecode instead of assuming it is
stable.

See the [5.0.0 release](https://github.com/algorand/go-algorand/releases/tag/v5.0.0-stable)
and focused [opcode-budget example](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/op_budget/contract.algo.ts)
rather than reproducing release notes or API catalogs.
