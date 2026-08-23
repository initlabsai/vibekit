# Migrations

Migrate only after identifying the exact source and target versions. Do not
apply an old rename table wholesale.

## Establish the baseline

1. Read `package.json`, the lockfile, compiler config, generated artifacts,
   deployment metadata, and tests.
2. Compile and run the current test suite before changing APIs.
3. Record public ABI signatures, ARC-56/ARC-32 artifacts, state keys and
   encodings, schema, boxes, template variables, update/delete policy, and
   deployed app IDs.
4. Read the release-specific [PuyaTs migration guide](https://github.com/algorandfoundation/puya-ts/blob/main/docs/src/content/docs/migration-guides.md)
   and relevant client-library migration notes.

Preserve wire compatibility deliberately. A source-level refactor can still
change method selectors, tuple encoding, state layout, event signatures,
compiled program behavior, or deployment decisions.

## TEALScript or Algorand TypeScript beta

Move to current `@algorandfoundation/algorand-typescript` imports and compiler
syntax. Replace legacy decorators, storage wrappers, transaction builders,
copy semantics, and template-variable APIs only where the installed migration
guide requires it. Use current PuyaTs examples to reconstruct each pattern,
then compile after every small group of changes.

Do not preserve a legacy pattern merely because it type-checks. Confirm the
generated TEAL and application specification, especially around ARC-4 types,
array/object aliasing, boxes, inner transactions, and lifecycle methods.

## ARC-32 to ARC-56

Prefer ARC-56 for new generated clients. ARC-32 remains Final but its own spec
says it will eventually be deprecated by ARC-56. Regenerate from compiler
output when possible; do not manually translate a large JSON artifact.

Before replacing ARC-32, verify every consumer supports ARC-56 and compare:
methods, bare actions, structs, state, events, source maps, bytecode/template
variables, networks, and deployment metadata. Keep ARC-32 only as a deliberate
compatibility artifact when a current consumer still needs it.

## Operations belong elsewhere

This guide ends at compatible code and artifacts. In a VibeKit project, use
`use-vibekit` for LocalNet reset, accounts, deployment, and on-chain migration
operations. Never overwrite or replace a deployed application based only on a
successful local compile.
