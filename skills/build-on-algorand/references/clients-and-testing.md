# Clients and testing

Contract artifacts are the boundary between on-chain and off-chain TypeScript.
Prefer an ARC-56 artifact and a generated client over hand-encoding ABI calls.

## Generated clients

Use the project's existing client-generation script. Regenerate after changing
public methods, structs, events, state, template variables, or lifecycle
configuration. Do not hand-edit generated files.

Before calling a generated API:

1. Read the generated constructor and method types; generator versions differ.
   A client targets a known app ID, while a factory creates or deploys
   application instances.
2. Use the app ID and network selected by the project.
3. Pass the sender and signer explicitly unless the existing client factory
   deliberately registers defaults.
4. Build transaction arguments with the same `AlgorandClient`/algosdk context
   as the app call.
5. Use `bigint` for app IDs, asset IDs, and atomic amounts unless the generated
   type requires otherwise. Do display-unit conversion only at an input/output
   boundary.

Use the [TypeScript client-generator guide](https://dev.algorand.co/algokit/client-generator/typescript/).
For off-chain usage, prefer the runnable [application](https://github.com/algorandfoundation/algokit-utils-ts/blob/docs-staging/examples/concepts/applications.algo.ts)
and [transaction](https://github.com/algorandfoundation/algokit-utils-ts/blob/docs-staging/examples/concepts/transactions.algo.ts)
examples instead of reproducing the client API.

## Test at two levels

- **Unit tests** are fast and useful for contract branches, state transitions,
  AVM values, opcodes, and failure cases. Use the project's current Algorand
  TypeScript testing package and conventions. In PuyaTs projects, transformed
  AVM tests conventionally use `.algo.spec.ts` or `.algo.test.ts`; an ordinary
  test file does not automatically receive those semantics.
- **Compiled integration tests** exercise generated TEAL, real transaction
  groups, fees, resources, minimum balance, generated clients, and ledger
  behavior. They catch failures a TypeScript-level test cannot.

A passing transformed unit test does not prove compiled TEAL behavior, fees,
resource availability, or ledger effects. Keep both levels when the contract
controls value or authorization.

For every privileged or value-moving method, cover success and rejection:
wrong sender, wrong transaction field, boundary amount, repeated call,
missing resource, insufficient fee/balance, and unauthorized lifecycle action.
Test box creation and deletion with their minimum-balance effects.

Start from the [TypeScript unit-testing guide](https://dev.algorand.co/algokit/unit-testing/typescript/overview/)
and the project's existing end-to-end tests.

## Debug with simulation

On a logic failure, preserve the complete error, transaction group, app ID,
program counter, and source map. Simulate the same group with traces and
resource/fee reporting, then map the failure through the ARC-56 source info.
Do not retry a write blindly or fall back to removed `dryrun`/`tealdbg`
workflows.
