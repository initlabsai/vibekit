# Algorand Python Types

## Contents

- [Core AVM Types](#core-avm-types)
- [Reference Types](#reference-types)
- [Python Built-in Types](#python-built-in-types)
- [ARC-4 Types](#arc-4-types)
- [Native Collection Types (Algorand Python 2.7+)](#native-collection-types-algorand-python-27)
- [Common Pitfalls](#common-pitfalls)
- [References](#references)

Algorand Python provides statically-typed representations of AVM (Algorand Virtual Machine) types. These types differ from standard Python types and are essential for writing correct smart contracts.

## Core AVM Types

### UInt64

`algopy.UInt64` represents a 64-bit unsigned integer—the primary numeric type on the AVM.

```python
import algopy

# CORRECT - Initialize with integer literal
num = algopy.UInt64(1)
zero = algopy.UInt64()  # Defaults to 0

# CORRECT - Arithmetic operations
total = num + 100
result = num * 2
divided = num // 3  # Must use floor division

# CORRECT - Boolean evaluation (zero is False)
if num:
    algopy.log("Non-zero value")

# INCORRECT - Regular division not allowed
# bad = num / 2  # Error: Use // instead
```

**Key differences from Python `int`:**

| Feature | Python `int` | `algopy.UInt64` |
|---------|--------------|-----------------|
| Range | Unbounded | 0 to 2^64-1 |
| Signed | Yes | No (unsigned only) |
| Division | `/` allowed | Must use `//` |
| Overflow | Never | Errors on overflow |

### Bytes

`algopy.Bytes` represents a byte sequence with a maximum length of 4096 bytes.

```python
import algopy

data = algopy.Bytes(b"abc")
empty = algopy.Bytes()

combined = data + b"def"       # Concatenation
first = data[0]                # Returns Bytes(b"a"), NOT int 97
slice = data[:2]               # Bytes(b"ab")
length = data.length           # UInt64(3) — NOT len(data)

# Construct from encodings
from_hex = algopy.Bytes.from_hex("FF")
from_base64 = algopy.Bytes.from_base64("RkY=")

# Binary operations
xor_result = data ^ b"xyz"
```

**Key differences from Python `bytes`:**

| Feature | Python `bytes` | `algopy.Bytes` |
|---------|----------------|----------------|
| Max length | Memory limit | 4096 bytes |
| Indexing | Returns `int` | Returns `Bytes` |
| Length | `len(x)` | `x.length` |

### String

`algopy.String` represents a UTF-8 encoded string backed by `Bytes`.

```python
import algopy

text = algopy.String("hello")
greeting = text + " world"          # Concatenation
result = algopy.String(", ").join((text, text))  # "hello, hello"
raw = text.bytes                     # Bytes(b"hello")
byte_length = text.bytes.length      # UInt64(5)

# Supported: startswith(), endswith(), `in` operator
# NOT supported: indexing (text[0]), slicing, len()
```

**String limitations:**

- No indexing (`text[0]`)
- No slicing (`text[1:3]`)
- No `len()` function (use `.bytes.length` for byte count)
- Expensive containment check (`in` operator)

### BigUInt

`algopy.BigUInt` represents a variable-length unsigned integer up to 512 bits.

```python
import algopy

# CORRECT - Initialize with integer or UInt64
big = algopy.BigUInt(12345678901234567890)
from_uint = algopy.BigUInt(algopy.UInt64(100))

# CORRECT - Arithmetic (same as UInt64)
result = big + 1000
divided = big // 10

# INCORRECT - No power or shift operators
# bad = big ** 2  # Error: Not supported
# bad = big << 2  # Error: Not supported
```

**When to use BigUInt:**

- Numbers exceeding 2^64-1
- Cryptographic operations requiring large integers
- High-precision financial calculations

**Cost consideration:** BigUInt operations are ~10x more expensive than UInt64 operations. Use `algopy.op` wide operations (`addw`, `mulw`) for overflow handling when possible.

## Reference Types

Reference types represent on-chain entities and require "resource availability" to access their properties.

### Account

`algopy.Account` represents an Algorand address.

```python
import algopy

# CORRECT - Initialize with address string
account = algopy.Account("WMHF4FLJNKY2BPFK7YPV5ID6OZ7LVDB2B66ZTXEAMLL2NX4WJZRJFVX66M")

# CORRECT - Initialize from bytes (32 bytes)
from_bytes = algopy.Account(some_32_bytes)

# Zero address (default)
zero_addr = algopy.Account()

# CORRECT - Boolean check (False if zero-address)
if account:
    algopy.log("Valid address")

# CORRECT - Access properties (requires resource availability)
balance = account.balance  # UInt64 in microAlgos
min_bal = account.min_balance
auth = account.auth_address  # Rekeyed address

# CORRECT - Check opt-in status
asset = algopy.Asset(1234)
if account.is_opted_in(asset):
    algopy.log("Opted into asset")

app = algopy.Application(5678)
if account.is_opted_in(app):
    algopy.log("Opted into app")

# CORRECT - Get raw bytes
raw = account.bytes  # 32 bytes
```

**Account properties (require resource availability):**

| Property | Type | Description |
|----------|------|-------------|
| `balance` | `UInt64` | Balance in microAlgos |
| `min_balance` | `UInt64` | Minimum required balance |
| `auth_address` | `Account` | Rekeyed-to address |
| `total_apps_created` | `UInt64` | Apps created by account |
| `total_apps_opted_in` | `UInt64` | Apps account opted into |
| `total_assets_created` | `UInt64` | Assets created |
| `total_extra_app_pages` | `UInt64` | Extra app pages |
| `bytes` | `Bytes` | Raw 32-byte address |

### Asset

`algopy.Asset` represents an Algorand Standard Asset (ASA).

```python
import algopy

# CORRECT - Initialize with asset ID
asset = algopy.Asset(1234)
invalid = algopy.Asset()  # ID 0 (invalid)

# CORRECT - Boolean check (False if ID is 0)
if asset:
    algopy.log("Valid asset")

# CORRECT - Access properties (requires resource availability)
name = asset.name  # Bytes
unit = asset.unit_name  # Bytes
total = asset.total  # UInt64
decimals = asset.decimals  # UInt64
creator = asset.creator  # Account
manager = asset.manager  # Account

# CORRECT - Get balance for an account
account = algopy.Account("...")
balance = asset.balance(account)

# CORRECT - Check frozen status
is_frozen = asset.frozen(account)
```

**Asset properties (require resource availability):**

| Property | Type | Description |
|----------|------|-------------|
| `id` | `UInt64` | Asset ID |
| `name` | `Bytes` | Asset name |
| `unit_name` | `Bytes` | Unit name (ticker) |
| `total` | `UInt64` | Total supply |
| `decimals` | `UInt64` | Decimal places |
| `creator` | `Account` | Creator address |
| `manager` | `Account` | Manager address |
| `reserve` | `Account` | Reserve address |
| `freeze` | `Account` | Freeze address |
| `clawback` | `Account` | Clawback address |
| `default_frozen` | `bool` | Default frozen state |
| `url` | `Bytes` | Asset URL |
| `metadata_hash` | `Bytes` | 32-byte hash |

### Application

`algopy.Application` represents a smart contract application.

```python
import algopy

# CORRECT - Initialize with app ID
app = algopy.Application(5678)
invalid = algopy.Application()  # ID 0 (invalid)

# CORRECT - Boolean check
if app:
    algopy.log("Valid app")

# CORRECT - Access properties (requires resource availability)
creator = app.creator  # Account
address = app.address  # Account (app's address)
```

## Python Built-in Types

Standard Python types have limited support in Algorand Python.

### Supported

| Type | Usage |
|------|-------|
| `bool` | Full support |
| `tuple` | Arguments, return types, local variables |
| `typing.NamedTuple` | Structured data |
| `None` | Return type annotation only |

### NamedTuple

```python
import typing
from algopy import UInt64, String

class Point(typing.NamedTuple):
    x: UInt64
    y: UInt64

# Use as local variable or return type
p = Point(x=UInt64(10), y=UInt64(20))
assert p.x == UInt64(10)
```

### Limited Support

```python
# Module-level constants only
MY_CONSTANT: int = 42
MY_STRING: str = "hello"
MY_BYTES: bytes = b"data"

# CORRECT - Use with AVM types
num = algopy.UInt64(MY_CONSTANT)
text = algopy.String(MY_STRING)
data = algopy.Bytes(MY_BYTES)

# INCORRECT - Cannot use as local variables
# def my_method(self) -> None:
#     x: int = 5  # Error: Use UInt64
```

### Not Supported

- `float` — No floating-point on AVM
- Nested tuples
- `None` as a value (only as type annotation)

## ARC-4 Types

ARC-4 types provide ABI-compatible encoding. Import from `algopy.arc4`.

```python
from algopy import arc4

# ARC-4 integers (big-endian encoded)
uint8 = arc4.UInt8(255)
uint64 = arc4.UInt64(12345)
uint256 = arc4.BigUIntN[typing.Literal[256]](...)

# ARC-4 strings (length-prefixed)
arc4_str = arc4.String("hello")
native_str = arc4_str.native  # Convert to algopy.String

# ARC-4 dynamic bytes
dyn_bytes = arc4.DynamicBytes(b"data")

# ARC-4 address (32 bytes)
address = arc4.Address("WMHF4...")
native_account = address.native  # Convert to algopy.Account

# ARC-4 arrays
static_arr = arc4.StaticArray[arc4.UInt8, typing.Literal[4]](...)
dynamic_arr = arc4.DynamicArray[arc4.UInt64](...)
```

### arc4.Struct

Define structured data types for ABI encoding, box storage, and events:

```python
from algopy import arc4

class UserProfile(arc4.Struct):
    name: arc4.String
    age: arc4.UInt64
    active: arc4.Bool

# Create an instance
user = UserProfile(
    name=arc4.String("Alice"),
    age=arc4.UInt64(30),
    active=arc4.Bool(True),
)

# Access fields
name = user.name            # arc4.String
native_name = user.name.native  # algopy.String

# Use as method parameter or return type
@arc4.abimethod
def get_user(self) -> UserProfile:
    return UserProfile(
        name=arc4.String("Alice"),
        age=arc4.UInt64(30),
        active=arc4.Bool(True),
    )
```

**When to use ARC-4 types:**

- ABI method parameters and return values
- Structured data in boxes or state
- Interoperability with other contracts/clients

**Conversion to native types:**

```python
# Use .native property to convert
arc4_value = arc4.UInt64(100)
native_value = arc4_value.native  # algopy.UInt64
```

## Native Collection Types (Algorand Python 2.7+)

Algorand Python provides native mutable collection and struct types that are more efficient than their ARC-4 equivalents for internal logic:

| Type | Description |
|------|-------------|
| `algopy.Array[T]` | Dynamic-length mutable array |
| `algopy.ImmutableArray[T]` | Dynamic-length immutable array |
| `algopy.FixedArray[T, N]` | Fixed-length mutable array |
| `algopy.ReferenceArray[T]` | Array of reference types (Account, Asset, Application) |
| `algopy.Struct` | Native struct (non-ARC-4) — more efficient for internal use |

```python
from algopy import Array, FixedArray, Struct, UInt64, String

class UserData(Struct):
    name: String
    score: UInt64

# Dynamic array
scores = Array[UInt64]()
scores.append(UInt64(100))

# Fixed array
slots = FixedArray[UInt64, typing.Literal[4]]()
slots[0] = UInt64(42)
```

**When to use native vs ARC-4 types:**

- Use native types (`Array`, `Struct`) for internal contract logic — more efficient
- Use ARC-4 types (`arc4.DynamicArray`, `arc4.Struct`) for ABI method parameters/returns, storage, and cross-contract interfaces
- Native mutable types require `.copy()` just like ARC-4 mutable types

## Common Pitfalls

- Use `UInt64` not `int` for local variables (Python `int` only for module-level constants)
- Use `.length` not `len()` for `Bytes`/`String`
- Use `//` not `/` for division (`UInt64` is integer-only)
- Use `urange()` / `uenumerate()` instead of `range()` / `enumerate()`
- Reference type properties (`account.balance`, `asset.total`) require resource availability in the transaction's foreign arrays

## References

- [Algorand Python Types Documentation](https://dev.algorand.co/algokit/languages/python/lg-types/)
- [ARC-4 Types](https://dev.algorand.co/algokit/languages/python/lg-arc4/)
- [Python Builtins](https://dev.algorand.co/algokit/languages/python/lg-builtins/)
- [algopy API Reference](https://dev.algorand.co/reference/algorand-python/api/api-algopy/)
