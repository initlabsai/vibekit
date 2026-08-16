# Algorand Python Storage Patterns

## Contents

- [Storage Types Overview](#storage-types-overview)
- [GlobalState](#globalstate)
- [LocalState](#localstate)
- [Box Storage](#box-storage)
- [Minimum Balance Requirement (MBR)](#minimum-balance-requirement-mbr)
- [Choosing Storage Type](#choosing-storage-type)
- [Common Mistakes](#common-mistakes)
- [References](#references)

Store data on-chain using GlobalState, LocalState, and Box storage in Algorand Python smart contracts.

## Storage Types Overview

| Storage | Scope | Who Pays MBR | Max Size | Use Case |
|---------|-------|--------------|----------|----------|
| `GlobalState` | App-wide | App creator | 64 keys, 8KB total | Shared app data |
| `LocalState` | Per-user | User (on opt-in) | 16 keys, 2KB total | Per-user data with opt-in |
| `Box` | App-wide | App account | 32KB per box | Large single values |
| `BoxMap` | Per-key | App account | 32KB per box | Per-user data without opt-in |
| `BoxRef` | App-wide | App account | 32KB | Raw binary data, manual sizing |

## GlobalState

Store app-wide data accessible by all users. Two approaches available:

### Simple Assignment (Recommended for Basic Use)

```python
from algopy import ARC4Contract, UInt64, Bytes, arc4

class MyContract(ARC4Contract):
    def __init__(self) -> None:
        # Simple assignment - uses variable name as key
        self.counter = UInt64(0)
        self.name = Bytes(b"MyApp")
        self.active = True

    @arc4.abimethod
    def increment(self) -> None:
        self.counter += 1
```

### GlobalState Wrapper (For Advanced Control)

```python
from algopy import ARC4Contract, GlobalState, UInt64, Bytes, arc4

class MyContract(ARC4Contract):
    def __init__(self) -> None:
        # With custom key and description (for ARC-32/56 app spec)
        self.counter = GlobalState(
            UInt64(0),
            key="cnt",
            description="Transaction counter"
        )
        # No default value - must set before reading
        self.owner = GlobalState(Bytes)

    @arc4.abimethod
    def increment(self) -> UInt64:
        self.counter.value += 1
        return self.counter.value

    @arc4.abimethod
    def get_counter_safe(self) -> UInt64:
        # Check if value exists
        if self.counter:
            return self.counter.value
        return UInt64(0)

    @arc4.abimethod
    def get_with_default(self) -> Bytes:
        # Get with fallback default
        return self.owner.get(default=Bytes(b"unset"))

    @arc4.abimethod
    def get_maybe(self) -> tuple[UInt64, bool]:
        # Returns (value, exists)
        return self.counter.maybe()
```

### GlobalState Methods

| Method | Description |
|--------|-------------|
| `.value` | Get/set the value (errors if not set) |
| `.get(default)` | Get value or return default |
| `.maybe()` | Returns `(value, exists)` tuple |
| `bool(state)` | `True` if value is set |
| `.key` | Access raw storage key |

## LocalState

Store per-user data. Requires user to opt-in to the application first.

```python
from algopy import ARC4Contract, LocalState, UInt64, Bytes, Account, Txn, arc4

class MyContract(ARC4Contract):
    def __init__(self) -> None:
        self.user_balance = LocalState(UInt64, key="bal")
        self.user_name = LocalState(Bytes)

    @arc4.abimethod(allow_actions=["OptIn"])
    def opt_in(self) -> None:
        # Initialize local state on opt-in
        self.user_balance[Txn.sender] = UInt64(0)

    @arc4.abimethod
    def deposit(self, amount: UInt64) -> None:
        self.user_balance[Txn.sender] += amount

    @arc4.abimethod
    def get_balance(self, account: Account) -> UInt64:
        # Direct access (fails if not opted in)
        return self.user_balance[account]

    @arc4.abimethod
    def get_balance_safe(self, account: Account) -> UInt64:
        # Check if account has local state
        if account in self.user_balance:
            return self.user_balance[account]
        return UInt64(0)

    @arc4.abimethod
    def get_balance_default(self, account: Account) -> UInt64:
        # Get with default
        return self.user_balance.get(account, default=UInt64(0))

    @arc4.abimethod
    def get_balance_maybe(self, account: Account) -> tuple[UInt64, bool]:
        # Returns (value, exists)
        return self.user_balance.maybe(account)

    @arc4.abimethod
    def clear_balance(self, account: Account) -> None:
        # Delete local state entry
        del self.user_balance[account]
```

### LocalState Methods

| Method | Description |
|--------|-------------|
| `state[account]` | Get/set value for account |
| `state.get(account, default)` | Get value or return default |
| `state.maybe(account)` | Returns `(value, exists)` tuple |
| `account in state` | `True` if account has value |
| `del state[account]` | Delete value for account |
| `.key` | Access raw storage key |

## Box Storage

Store larger data without user opt-in. App account pays MBR.

### Box (Single Value)

```python
from algopy import ARC4Contract, Box, UInt64, Bytes, arc4, String

class MyContract(ARC4Contract):
    def __init__(self) -> None:
        # Box with compile-time constant key
        self.config = Box(UInt64, key=b"config")
        self.data = Box(Bytes, key=b"data")

    @arc4.abimethod
    def set_config(self, value: UInt64) -> None:
        # Automatically creates box if needed
        self.config.value = value

    @arc4.abimethod
    def get_config(self) -> UInt64:
        # Check existence first
        if self.config:
            return self.config.value
        return UInt64(0)

    @arc4.abimethod
    def get_config_maybe(self) -> tuple[UInt64, bool]:
        return self.config.maybe()

    @arc4.abimethod
    def delete_config(self) -> None:
        # Delete box to reclaim MBR
        del self.config.value
```

### Box with Dynamic Key

```python
from algopy import ARC4Contract, Box, UInt64, String, arc4

class MyContract(ARC4Contract):
    @arc4.abimethod
    def create_named_box(self, name: String) -> None:
        # Create box with dynamic key inside method
        box = Box(UInt64, key=name.bytes)
        box.value = UInt64(100)

    @arc4.abimethod
    def read_named_box(self, name: String) -> UInt64:
        box = Box(UInt64, key=name.bytes)
        if box:
            return box.value
        return UInt64(0)
```

### Box Methods

| Method | Description |
|--------|-------------|
| `.value` | Get/set the box value |
| `.get(default=...)` | Get value or return default |
| `.maybe()` | Returns `(value, exists)` tuple |
| `bool(box)` | `True` if box exists |
| `del box.value` | Delete the box |
| `.create(size=...)` | Create box with specific size |
| `.length` | Get box length in bytes |
| `.extract(start, length)` | Extract bytes from box |
| `.replace(start, value)` | Replace bytes in box |
| `.splice(start, stop, value)` | Splice bytes in box |

### BoxMap (Per-Key Storage)

Best for per-user data when you don't want to require opt-in.

```python
from algopy import ARC4Contract, BoxMap, UInt64, String, Account, Txn, arc4

class MyContract(ARC4Contract):
    def __init__(self) -> None:
        # BoxMap with key type and value type
        self.balances = BoxMap(Account, UInt64, key_prefix="bal_")
        self.names = BoxMap(UInt64, String, key_prefix="name_")

    @arc4.abimethod
    def deposit(self, amount: UInt64) -> None:
        sender = Txn.sender
        if sender in self.balances:
            self.balances[sender] += amount
        else:
            self.balances[sender] = amount

    @arc4.abimethod
    def get_balance(self, account: Account) -> UInt64:
        if account in self.balances:
            return self.balances[account]
        return UInt64(0)

    @arc4.abimethod
    def get_balance_default(self, account: Account) -> UInt64:
        return self.balances.get(account, default=UInt64(0))

    @arc4.abimethod
    def get_balance_maybe(self, account: Account) -> tuple[UInt64, bool]:
        return self.balances.maybe(account)

    @arc4.abimethod
    def withdraw_all(self) -> UInt64:
        sender = Txn.sender
        balance = self.balances.get(sender, default=UInt64(0))
        if balance > 0:
            del self.balances[sender]  # Delete to reclaim MBR
        return balance
```

### BoxMap Methods

| Method | Description |
|--------|-------------|
| `map[key]` | Get/set value for key |
| `map.get(key, default=...)` | Get value or return default |
| `map.maybe(key)` | Returns `(value, exists)` tuple |
| `key in map` | `True` if key exists |
| `del map[key]` | Delete the box |
| `.length(key)` | Get box length for key |
| `.key_prefix` | Access raw key prefix |
| `.box(key)` | Get Box proxy for key |

### BoxRef (Raw Binary Data)

For manual control over large binary data.

```python
from algopy import ARC4Contract, BoxRef, Bytes, UInt64, Txn, Global, arc4

class MyContract(ARC4Contract):
    def __init__(self) -> None:
        self.blob = BoxRef(key=b"blob")

    @arc4.abimethod
    def create_blob(self, size: UInt64) -> bool:
        # Manually create box with specific size
        return self.blob.create(size=size)

    @arc4.abimethod
    def write_to_blob(self, offset: UInt64, data: Bytes) -> None:
        self.blob.replace(offset, data)

    @arc4.abimethod
    def read_from_blob(self, offset: UInt64, length: UInt64) -> Bytes:
        return self.blob.extract(offset, length)

    @arc4.abimethod
    def delete_blob(self) -> bool:
        return self.blob.delete()
```

## Minimum Balance Requirement (MBR)

### MBR Formulas

**Global State:**
```
100,000 + (28,500 * NumUint) + (50,000 * NumByteSlice) microAlgos
```

**Local State (per opt-in):**
```
100,000 + (28,500 * NumUint) + (50,000 * NumByteSlice) microAlgos
```

**Box Storage:**
```
2,500 + (400 * (key_length + value_length)) microAlgos per box
```

### Box MBR Examples

| Box Name | Size | MBR Cost |
|----------|------|----------|
| "a" (1 byte) | 100 bytes | 2,500 + 400×101 = 42,900 µAlgo |
| "user" (4 bytes) | 1024 bytes | 2,500 + 400×1028 = 413,700 µAlgo |
| 32-byte key | 8 bytes | 2,500 + 400×40 = 18,500 µAlgo |

### Funding App Account for Boxes (CRITICAL)

The app account must be funded BEFORE creating boxes.

```python
# In your deploy script or test setup:
from algokit_utils import AlgorandClient

algorand = AlgorandClient.from_environment()
deployer = algorand.account.from_environment("DEPLOYER")

# Deploy the contract
factory = algorand.client.get_typed_app_factory(MyAppFactory)
result = factory.deploy()

# Fund app account for box MBR
if result.operation_performed in ["create", "replace"]:
    algorand.send.payment(
        sender=deployer.address,
        receiver=result.app_client.app_address,
        amount=1_000_000  # 1 Algo for box storage
    )
```

### Calculating MBR in Contract

```python
from algopy import ARC4Contract, UInt64, arc4

class MyContract(ARC4Contract):
    @arc4.abimethod
    def calculate_box_mbr(self, key_length: UInt64, value_length: UInt64) -> UInt64:
        return UInt64(2500) + (key_length + value_length) * UInt64(400)
```

## Choosing Storage Type

| Scenario | Recommended | Reason |
|----------|-------------|--------|
| App configuration | `GlobalState` | Simple, always available |
| Per-user data, user pays | `LocalState` | User covers MBR on opt-in |
| Per-user data, app pays | `BoxMap` | No opt-in needed |
| Large single value | `Box` | Up to 32KB per box |
| Large binary blob | `BoxRef` | Manual size control |
| Dynamic key-value store | `BoxMap` | Flexible key types |

## Common Mistakes

### Forgetting to Fund App Account for Boxes

```python
# INCORRECT - Box creation fails if app not funded
@arc4.abimethod
def create_user(self, account: Account) -> None:
    self.users[account] = UInt64(0)  # Fails: insufficient MBR

# CORRECT - Fund app account before creating boxes
# (Done externally via payment transaction)
```

### Not Checking Box Existence

```python
# INCORRECT - Fails if box doesn't exist
@arc4.abimethod
def get_value(self) -> UInt64:
    return self.my_box.value  # Error if not set

# CORRECT - Check first or use get/maybe
@arc4.abimethod
def get_value_safe(self) -> UInt64:
    if self.my_box:
        return self.my_box.value
    return UInt64(0)

# OR
@arc4.abimethod
def get_value_default(self) -> UInt64:
    return self.my_box.get(default=UInt64(0))
```

### Not Deleting Boxes to Reclaim MBR

```python
# CORRECT - Delete boxes when no longer needed
@arc4.abimethod
def cleanup_user(self, account: Account) -> None:
    if account in self.users:
        del self.users[account]  # Reclaims MBR
```

### Missing `.copy()` on Mutable Values

When modifying mutable values (appending to arrays, assigning structs to storage), you must call `.copy()`. This applies to both **ARC-4 types** and **native mutable types**:

**ARC-4 mutable types** requiring `.copy()`: `arc4.DynamicArray`, `arc4.StaticArray`, `arc4.Struct`

**Native mutable types** requiring `.copy()` (Algorand Python 2.7+): `algopy.Array`, `algopy.FixedArray`, `algopy.Struct`

**Exception:** `frozen` structs with no mutable fields do not need `.copy()`.

```python
# INCORRECT — "mutable reference must be copied using .copy()"
todos.append(new_todo)
self.user_map[key] = user_struct

# CORRECT — .copy() before mutation or storage assignment
todos.append(new_todo.copy())
self.user_map[key] = user_struct.copy()
```

This is the Python equivalent of TypeScript's `clone()` — the AVM requires explicit
copying for mutable references.

### Using LocalState Without Opt-in Check

```python
# INCORRECT - Fails if user not opted in
@arc4.abimethod
def get_user_data(self, account: Account) -> UInt64:
    return self.user_data[account]  # Error if not opted in

# CORRECT - Check opt-in status
@arc4.abimethod
def get_user_data_safe(self, account: Account) -> UInt64:
    if account in self.user_data:
        return self.user_data[account]
    return UInt64(0)
```

## References

- [Algorand Python Storage Documentation](https://dev.algorand.co/algokit/languages/python/lg-storage/)
- [Box Storage Concepts](https://dev.algorand.co/concepts/smart-contracts/storage/box/)
- [Global Storage Concepts](https://dev.algorand.co/concepts/smart-contracts/storage/global/)
- [Local Storage Concepts](https://dev.algorand.co/concepts/smart-contracts/storage/local/)
- [Protocol Parameters (MBR)](https://dev.algorand.co/concepts/protocol/protocol-parameters/)

> **See also:** `algorand-core` skill ([avm-resource-limits.md](../../algorand-core/references/avm-resource-limits.md)) for complete MBR formulas and storage size limits.
