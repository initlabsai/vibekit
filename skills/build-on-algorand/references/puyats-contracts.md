# PuyaTs contracts

PuyaTs compiles Algorand TypeScript into TEAL. Write for the AVM type system,
even though the syntax and editor tooling look familiar.

## Types first

- Never annotate a contract value as `number`. Use `uint64` for AVM integers,
  `biguint` when wider arithmetic is required, and `bytes` for byte strings.
- Use ARC-4 types when their ABI encoding is part of a public method or stored
  representation. Do not assume a native AVM value and its ARC-4 wrapper have
  identical operations or encoding.
- Give arrays and objects explicit types. Static arrays are cheaper and more
  predictable when the length is known.
- Arrays and objects are reference types. Assignment aliases the same value;
  use `clone(value)` when subsequent mutation must be independent.
- Do not use union-heavy domain models, exceptions, promises, dynamic property
  access, standard collection APIs, or JavaScript runtime globals unless the
  current language guide explicitly supports them.

Read the current [Algorand TypeScript guide](https://dev.algorand.co/concepts/smart-contracts/languages/typescript/)
and PuyaTs [type guide](https://github.com/algorandfoundation/puya-ts/blob/main/docs/src/content/docs/language-guide/types.md)
when a construct is uncertain. Let the compiler reject unsupported language
features; do not work around it with casts.

## Contract surface

Prefer an ARC-4 contract for an application intended for clients:

- expose ABI methods deliberately and keep helpers `private`;
- state allowed on-completion actions and creation behavior explicitly;
- use ABI transaction arguments for payments or transfers that a method must
  validate atomically;
- use readonly methods only when execution is actually side-effect-free;
- emit structured events only when consumers need them and follow ARC-28;
- make update and delete authorization visible in the contract.

Generated ARC-56 output is part of the public interface. Method names,
argument types, structs, state declarations, events, and lifecycle choices
affect generated clients; review the artifact after compilation.

## Use examples as the API reference

Prefer small, current compiler examples over copied syntax catalogs:

- [ARC-4 hello world](https://github.com/algorandfoundation/puya-ts/blob/main/examples/hello-world-abi/contract.algo.ts)
- [ARC-4 method options](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/abimethod_options/contract.algo.ts)
- [ARC-4 types](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/arc4_types/contract.algo.ts)
- [Typed cross-contract ARC-4 calls](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/arc4_client/contract.algo.ts)
- [Contract options](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/contract_options/contract.algo.ts)
- [Events](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/events/contract.algo.ts)
- [Auction: state, transaction arguments, and inner transactions](https://github.com/algorandfoundation/puya-ts/blob/main/examples/auction/contract.algo.ts)
- [Voting application](https://github.com/algorandfoundation/puya-ts/blob/main/examples/voting/contract.algo.ts)
- [All focused devportal examples](https://github.com/algorandfoundation/puya-ts/tree/main/examples/devportal)
- [All PuyaTs examples](https://github.com/algorandfoundation/puya-ts/tree/main/examples)

Follow the project's imports and compiler version. Do not transplant code from
a different release without compiling it locally.
