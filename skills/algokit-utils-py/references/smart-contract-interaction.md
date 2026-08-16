## Smart contract interaction

> All snippets in this section assume an `AlgorandClient` named `algorand` and
> an account named `caller` — see [Client initialization](#client-initialization)
> and [Account management](#account-management) for setup.

### Get an AppClient for an existing app by ID

Obtain an `AppClient` for a previously deployed app when you already know its app ID.

```python
from algokit_utils.applications.app_client import AppClient, AppClientParams

app_client = AppClient(
    AppClientParams(
        algorand=algorand,
        app_spec=app_spec_json,
        app_id=12345678,
        default_sender=caller.addr,
    )
)
```

**What just happened:** You created an `AppClient` bound to the deployed app at ID `12345678`. The client uses the ARC-56 (or ARC-32) app spec to understand the contract's ABI methods, state schema, and storage layout. It accepts ARC-56 `Arc56Contract` objects, ARC-32 objects, or raw JSON strings — ARC-32 specs are normalised to ARC-56 internally.

### Call an ABI method

Invoke a named ABI method on the deployed contract.

```python
from algokit_utils.applications.app_client import AppClientMethodCallParams

result = app_client.send.call(
    AppClientMethodCallParams(
        method="hello",
        args=["World"],
    )
)

print(f"Return value: {result.abi_return}")
```

**What just happened:** The client looked up the `hello` method in the app spec, ABI-encoded the arguments, sent an application call transaction, and decoded the return value. The `method` field accepts a plain name (`'hello'`) or a full ABI signature (`'hello(string)string'`). If the method is marked `readonly` in the ARC-56 spec, it is automatically executed via simulate instead of a real transaction.

### Make a bare app call

Send a raw application call with no ABI method selector.

```python
from algokit_utils.applications.app_client import AppClientBareCallParams

result = app_client.send.bare.call(AppClientBareCallParams())
```

**What just happened:** A bare NoOp application call was sent to the contract. Bare calls bypass ABI encoding — no method selector or typed arguments are included. The `bare` namespace also exposes `opt_in()`, `close_out()`, `clear_state()`, `delete()`, and `update()` for other on-completion types.

### Read global state

Fetch the contract's global state as raw key-value pairs.

```python
global_state = app_client.get_global_state()

for key, state in global_state.items():
    print(f"{key}: {state.value}")
```

**What just happened:** The client queried algod for the app's global state and returned it as a `dict[str, AppState]`. Each entry has a `value` (str or int) and `key_raw` (bytes). For ARC-56 specs with typed state keys, you can also use `app_client.state.global_state` to get values decoded according to the ABI types in the spec.

### Read local state

Fetch an account's local (opted-in) state for this contract.

```python
local_state = app_client.get_local_state(caller.addr)

for key, state in local_state.items():
    print(f"{key}: {state.value}")
```

**What just happened:** The client queried the local state that `caller` has stored for this app. Like global state, you get raw key-value pairs. For ARC-56 typed access, use `app_client.state.local_state(caller.addr)`.

### Read a box value

Fetch the contents of a single box by name.

```python
box_value = app_client.get_box_value("greeting")

print(f"Box bytes: {len(box_value)}")
```

**What just happened:** The client fetched the raw bytes stored in the box named `'greeting'`. The `name` parameter accepts `str`, `bytes`, or `AddressWithTransactionSigner`. To decode using an ABI type, use `app_client.get_box_value_from_abi_type('greeting', ABIType.from_string('string'))` instead.

### List box names

Retrieve the names of all boxes the contract currently holds.

```python
box_names = app_client.get_box_names()

for box in box_names:
    print(f"Box: {box.name} ({len(box.name_raw)} bytes)")
```

**What just happened:** The client queried algod for all box names associated with this app. Each `BoxName` has a human-readable `name` string and the raw `name_raw` bytes. This is useful for discovering what boxes exist before reading their values.

### Get multiple box values

Fetch all box values at once, optionally filtering by name.

```python
all_boxes = app_client.get_box_values()

for box in all_boxes:
    print(f"{box.name.name}: {len(box.value)} bytes")

# With a filter
prefixed = app_client.get_box_values(lambda name: name.name.startswith("user_"))
```

**What just happened:** The client fetched every box name and then retrieved each box's value individually. An optional filter function narrows the results. Note that this issues one HTTP request per box and is not atomic. For ABI-decoded values, use `app_client.get_box_values_from_abi_type(abi_type)` instead.

### Use the params builder for deferred calls

Build call parameters now, send them later — useful for composing into atomic groups.

```python
from algokit_utils.applications.app_client import AppClientMethodCallParams
from algokit_utils.models.amount import algo

# Build params without sending
my_call_params = app_client.params.call(
    AppClientMethodCallParams(
        method="my_method",
        args=[123, "hello"],
    )
)

# Use in an atomic group
algorand.new_group().add_app_call_method_call(my_call_params).add_payment(
    PaymentParams(
        sender=caller.addr,
        receiver=app_client.app_address,
        amount=algo(1),
    )
).send()
```

**What just happened:** `app_client.params.call()` resolved the ABI method, encoded the arguments, and returned a ready-to-use params object — but did not send anything. You can feed these params into `algorand.new_group()` to combine with other transactions in an atomic group. The `params` namespace mirrors `send` — it has `call()`, `opt_in()`, `delete()`, `update()`, `close_out()`, `fund_app_account()`, and a `bare` sub-namespace.
