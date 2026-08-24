# State and transactions

Choose storage and composition together: both affect minimum balance,
resources, fees, and the client call shape.

## Choose state deliberately

- **Global state** is small application-wide state that callers should be able
  to inspect directly.
- **Local state** belongs to an account/application pair and requires that
  account to opt in. Use it only when account opt-in is part of the product.
- **Boxes** support larger and dynamically keyed application state without
  account opt-in. The application account must fund their minimum balance, and
  calls must make sufficient box resources and I/O budget available.
- **Logs** are outputs, not durable application storage. Use ARC-28 when logs
  are intended as typed events.

State is declared with factory functions, not classes — `new` is a compile
error — and the option names are `key` / `keyPrefix`:

```ts
import { Box, BoxMap, GlobalState, LocalState } from '@algorandfoundation/algorand-typescript'

counter = GlobalState<uint64>({ key: 'c' })
score = LocalState<uint64>({ key: 's' })
config = Box<bytes>({ key: 'cfg' }) // one box, fixed key
greetings = BoxMap<string, string>({ keyPrefix: 'g' }) // one box per key
```

`this.greetings(name).value` reads or writes the box for `name`; `.exists`
checks first. The installed `@algorandfoundation/algorand-typescript/*.d.ts`
files are the authoritative API: when the compiler names a type it does not
recognize, read that type's declaration before guessing again.

Keep keys and encodings stable once clients depend on them. Bound user-created
state, decide who funds growth, and define deletion/refund behavior. A storage
proxy is not an ordinary JavaScript object: use only its supported write-through
operations. When loading a composite value into a local variable, clone it,
mutate the clone, and assign it back unless current compiler documentation
explicitly supports the in-place proxy operation.

Fund the application account before a box-creating call increases minimum
balance. Authorize deletion and define where any released balance may go; a
box refund is part of the value-flow design, not automatic user ownership.
Read the
[storage overview](https://dev.algorand.co/concepts/smart-contracts/storage/overview/)
and [box guide](https://dev.algorand.co/concepts/smart-contracts/storage/box/)
for current costs and reference rules.

## Validate group transactions

When an ABI method accepts a payment, asset transfer, or application-call
transaction, validate every field the invariant depends on. Typical checks
include:

- expected transaction type and group relationship;
- sender and intended receiver;
- exact or bounded amount in base units;
- asset ID or application ID;
- no unexpected `rekeyTo`, `closeRemainderTo`, or `assetCloseTo`;
- no unintended clawback, freeze, or asset-sender behavior;
- valid rounds, lease, note, and fee when they matter to replay or policy.

Never accept “some payment exists in this group” as proof that the application
received the required value.

## Inner transactions and resources

An application account is the sender of its inner transactions. Ensure it is
funded and opted into assets it must hold. Budget inner-transaction fees in the
outer group; fee pooling is useful, but a zero inner fee does not make the
group free.

Applications can read only resources available to the app call. Client-side
resource population and simulation reduce boilerplate, but contract
correctness must not depend on an undocumented client default. Declare or
populate accounts, assets, apps, and boxes intentionally.

Use the current PuyaTs [inner-transaction guide](https://github.com/algorandfoundation/puya-ts/blob/main/docs/src/content/docs/language-guide/itxns.md)
and focused examples for [global state](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/global_state/contract.algo.ts),
[local state](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/local_state/contract.algo.ts),
[box storage](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/box_storage/contract.algo.ts),
[group transactions](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/group_transactions/contract.algo.ts),
and [inner transactions](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/inner_transactions/contract.algo.ts).
For off-chain composition, use the AlgoKit Utils
[transaction examples](https://github.com/algorandfoundation/algokit-utils-ts/blob/docs-staging/examples/concepts/transactions.algo.ts).
