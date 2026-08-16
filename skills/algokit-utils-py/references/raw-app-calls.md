## Raw app calls

### Send a raw app call

Call an existing application without an ABI method (a "bare" no-op call).

```python
from algokit_utils.transactions.transaction_composer import AppCallParams

result = algorand.send.app_call(
    AppCallParams(
        sender=sender.addr,
        app_id=123,
    )
)

print(f"App call TX: {result.tx_ids[0]}")
```

**What just happened:** `algorand.send.app_call()` built, signed, and submitted a bare application call transaction with an `OnComplete` of `NoOp` (the default). No ABI method selector is involved. Use this when you know the app ID but do not have (or need) an app spec.

### Create an app from compiled TEAL

Deploy a new application by supplying approval and clear-state programs directly.

```python
from algokit_utils.transactions.transaction_composer import AppCreateParams

result = algorand.send.app_create(
    AppCreateParams(
        sender=sender.addr,
        approval_program="#pragma version 10\nint 1",
        clear_state_program="#pragma version 10\nint 1",
        schema={"global_ints": 1, "global_byte_slices": 1, "local_ints": 0, "local_byte_slices": 0},
    )
)

print(f"Created app {result.app_id} at {result.app_address}")
```

**What just happened:** `algorand.send.app_create()` compiled the TEAL source strings on the node, built an application-create transaction with the specified state schema, signed it, and submitted it. The returned `app_id` is the on-chain ID and `app_address` is its Algorand address.

### Update an app

Replace the approval and clear-state programs of an existing application.

```python
from algokit_utils.transactions.transaction_composer import AppUpdateParams

app_id = 123  # from a previous app_create result
update_result = algorand.send.app_update(
    AppUpdateParams(
        sender=sender.addr,
        app_id=app_id,
        approval_program="#pragma version 10\nint 1",
        clear_state_program="#pragma version 10\nint 1",
    )
)

print(f"Updated app in TX: {update_result.tx_ids[0]}")
```

**What just happened:** `algorand.send.app_update()` submitted an `UpdateApplication` transaction that swaps the on-chain programs. The `app_id` must reference an application the sender is authorized to update.

### Delete an app

Remove an application from the ledger.

```python
from algokit_utils.transactions.transaction_composer import AppDeleteParams

app_id = 123  # from a previous app_create result
delete_result = algorand.send.app_delete(
    AppDeleteParams(
        sender=sender.addr,
        app_id=app_id,
    )
)

print(f"Deleted app in TX: {delete_result.tx_ids[0]}")
```

**What just happened:** `algorand.send.app_delete()` submitted a `DeleteApplication` transaction. After confirmation the application's programs and state are removed from the ledger. The sender must be the app creator or authorized address.

### Call an ABI method

Invoke a specific ABI method on an existing application without using an AppClient.

```python
from algokit_abi.arc56 import Method
from algokit_utils.transactions.transaction_composer import AppCallMethodCallParams

method = Method.from_signature("hello(string)string")

result = algorand.send.app_call_method_call(
    AppCallMethodCallParams(
        sender=sender.addr,
        app_id=456,
        method=method,
        args=["world"],
    )
)

print(f"ABI return: {result.abi_return}")
```

**What just happened:** `algorand.send.app_call_method_call()` encoded the ABI method selector and arguments, built a no-op application call, signed it, and submitted it. The `abi_return` field contains the ABI-decoded return value. You construct the `Method` from a signature string — no app spec file is needed.

### Create an app via ABI method

Deploy a new application whose creation triggers an ABI method.

```python
from algokit_abi.arc56 import Method
from algokit_utils.transactions.transaction_composer import AppCreateMethodCallParams

method = Method.from_signature("createApplication(string)void")

result = algorand.send.app_create_method_call(
    AppCreateMethodCallParams(
        sender=sender.addr,
        method=method,
        args=["hello"],
        approval_program="#pragma version 10\nint 1",
        clear_state_program="#pragma version 10\nint 1",
        schema={"global_ints": 1, "global_byte_slices": 1, "local_ints": 0, "local_byte_slices": 0},
    )
)

print(f"Created app {result.app_id} via ABI method")
```

**What just happened:** `algorand.send.app_create_method_call()` combined an application-create transaction with ABI method encoding. The method selector and arguments are packed into the transaction's args while the approval and clear-state programs are deployed on-chain.
