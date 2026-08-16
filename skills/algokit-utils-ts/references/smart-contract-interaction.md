## Smart contract interaction

> All snippets in this section assume an `AlgorandClient` named `algorand` and
> an account named `caller` — see [Client initialization](#client-initialization)
> and [Account management](#account-management) for setup.

### Get an AppClient for an existing app by ID

Obtain an `AppClient` for a previously deployed app when you already know its
app ID.

```typescript
import appSpec from "./artifacts/MyContract.arc56.json";

const appClient = algorand.client.getAppClientById({
  appSpec,
  appId: 12345678n,
  defaultSender: caller.addr,
});
```

**What just happened:** You created an `AppClient` bound to the deployed app at
ID `12345678n`. The client uses the ARC-56 (or ARC-32) app spec to understand
the contract's ABI methods, state schema, and storage layout. It accepts ARC-56
`Contract` objects, ARC-32 `AppSpec` objects, or raw JSON strings — ARC-32 specs
are automatically normalised to ARC-56 internally. ARC-56 specs unlock richer
features like typed state access, struct definitions, and source-level error
mapping.

### Call an ABI method

Invoke a named ABI method on the deployed contract.

```typescript
const result = await appClient.send.call({
  method: "hello",
  args: ["World"],
});

console.log(`Return value: ${result.return}`);
```

**What just happened:** The client looked up the `hello` method in the app spec,
ABI-encoded the arguments, sent an application call transaction, and decoded the
return value. The `method` field accepts either a plain name (`'hello'`) or a
full signature (`'hello(string)string'`) — the latter is useful when the
contract has overloaded method names. If the method is marked `readonly` in an
ARC-56 spec, it is automatically executed via `simulate` instead of submitting a
real transaction, so no fees are spent.

### Make a bare app call

Send a raw application call with no ABI method selector.

```typescript
const result = await appClient.send.bare.call();
```

**What just happened:** A bare NoOp application call was sent to the contract.
Bare calls bypass ABI encoding — no method selector or typed arguments are
included. The `bare` namespace also exposes `optIn()`, `closeOut()`,
`clearState()`, `delete()`, and `update()` for the other on-completion types.

### Read global state

Fetch the contract's global state as raw key-value pairs.

```typescript
const globalState = await appClient.getGlobalState();

for (const [key, value] of Object.entries(globalState)) {
  console.log(`${key}: ${value.value}`);
}
```

**What just happened:** The client queried algod for the app's global state and
returned it as an `AppState` record. Each entry has a `value` (the raw value)
and a `valueRaw` (the `Uint8Array` bytes). For ARC-56 specs with typed state
keys, you can also use `appClient.state.global.getValue('myKey')` to get a
single value decoded according to the ABI type defined in the spec, or
`appClient.state.global.getAll()` to get all typed values at once.

### Read local state

Fetch an account's local (opted-in) state for this contract.

```typescript
const localState = await appClient.getLocalState(caller.addr);

for (const [key, value] of Object.entries(localState)) {
  console.log(`${key}: ${value.value}`);
}
```

**What just happened:** The client queried the local state that `caller` has
stored for this app. Like global state, you get raw key-value pairs. For ARC-56
typed access, use `appClient.state.local(caller.addr).getValue('myKey')` or
`appClient.state.local(caller.addr).getAll()`.

### Read a box value

Fetch the contents of a single box by name.

```typescript
const boxValue = await appClient.getBoxValue("greeting");

console.log(`Box bytes: ${boxValue.length}`);
```

**What just happened:** The client fetched the raw bytes stored in the box named
`'greeting'`. The `name` parameter accepts a `string`, `Uint8Array`, or other
`BoxIdentifier` types. To decode the bytes using an ABI type, use
`appClient.getBoxValueFromABIType('greeting', new ABIUintType(32))` instead. For
ARC-56 specs with typed box storage keys, use
`appClient.state.box.getValue('myBoxKey')` for automatic ABI decoding.

### List box names

Retrieve the names of all boxes the contract currently holds.

```typescript
const boxNames = await appClient.getBoxNames();

for (const box of boxNames) {
  console.log(`Box: ${box.name} (${box.nameRaw.length} bytes)`);
}
```

**What just happened:** The client queried algod for all box names associated
with this app. Each `BoxName` has a human-readable `name` string and the raw
`nameRaw` bytes. This is useful for discovering what boxes exist before reading
their values.

### Get multiple box values

Fetch all box values at once, optionally filtering by name.

```typescript
const allBoxes = await appClient.getBoxValues();

for (const { name, value } of allBoxes) {
  console.log(`${name.name}: ${value.length} bytes`);
}

// With a filter
const prefixedBoxes = await appClient.getBoxValues((name) =>
  name.name.startsWith("user_"),
);
```

**What just happened:** The client fetched every box name and then retrieved each
box's value individually. An optional filter function lets you narrow the results
(e.g. by prefix). Note that this issues one HTTP request per box and is not
atomic — values may be slightly out of sync if the contract is being updated
concurrently. For ABI-decoded values, use
`appClient.getBoxValuesFromABIType(abiType)` instead.

### Use the params builder for deferred calls

Build call parameters now, send them later — useful for composing into atomic
groups or passing as nested ABI transaction arguments.

```typescript
// Build params for an ABI call without sending
const myCallParams = await appClient.params.call({
  method: "my_method",
  args: [123, "hello"],
});

// Use in an atomic group
await algorand
  .newGroup()
  .addAppCallMethodCall(myCallParams)
  .addPayment({
    sender: caller.addr,
    receiver: appClient.appAddress,
    amount: algo(1),
  })
  .send();

// Or pass as a nested transaction argument to another method
await appClient.send.call({
  method: "outer_method",
  args: [myCallParams],
});
```

**What just happened:** `appClient.params.call()` resolved the ABI method, encoded
the arguments, and returned a ready-to-use params object — but did not send
anything. You can feed these params into `algorand.newGroup()` to combine with
other transactions in an atomic group, or pass them directly as an argument to
another ABI method call (the library automatically handles nested transaction
arguments). The `params` namespace mirrors `send` — it has `call()`, `optIn()`,
`delete()`, `update()`, `closeOut()`, `fundAppAccount()`, and a `bare` sub-namespace.
