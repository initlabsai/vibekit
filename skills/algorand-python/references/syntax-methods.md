# Algorand Python Decorators

## Contents

- [Contract Base Classes](#contract-base-classes)
- [@arc4.abimethod](#arc4abimethod)
- [@arc4.baremethod](#arc4baremethod)
- [@subroutine](#subroutine)
- [Lifecycle Methods](#lifecycle-methods)
- [Events (ARC-28)](#events-arc-28)
- [@logicsig (Logic Signatures)](#logicsig-logic-signatures)
- [Method Visibility Summary](#method-visibility-summary)
- [Common Mistakes](#common-mistakes)
- [References](#references)

Define smart contract methods and their behavior using decorators in Algorand Python.

## Contract Base Classes

### ARC4Contract (Recommended)

Use `ARC4Contract` for contracts that expose ABI methods.

```python
from algopy import ARC4Contract, arc4

class MyContract(ARC4Contract):
    @arc4.abimethod
    def hello(self, name: arc4.String) -> arc4.String:
        return "Hello, " + name
```

### Contract (Low-Level)

Use `Contract` for raw approval/clear program control.

```python
from algopy import Contract, UInt64

class MyContract(Contract):
    def approval_program(self) -> UInt64:
        return UInt64(1)  # Approve

    def clear_state_program(self) -> UInt64:
        return UInt64(1)  # Approve
```

## @arc4.abimethod

Marks a method as an ABI method callable by external transactions.

### Basic Usage

```python
from algopy import ARC4Contract, arc4, UInt64

class MyContract(ARC4Contract):
    @arc4.abimethod
    def add(self, a: arc4.UInt64, b: arc4.UInt64) -> arc4.UInt64:
        return arc4.UInt64(a.native + b.native)
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | `str` | Method name | Override method name in ABI |
| `create` | `"allow"`, `"require"`, `"disallow"` | `"disallow"` | Application creation behavior |
| `allow_actions` | `list[str]` | `["NoOp"]` | Allowed OnComplete actions |
| `readonly` | `bool` | `False` | Mark as read-only (no state changes) |
| `default_args` | `dict` | `{}` | Default argument sources |
| `resource_encoding` | `ResourceEncoding` | Auto | Control how reference types are encoded (PuyaPy 5.0+) |
| `validate_encoding` | `bool` | `True` | Validate ARC-4 encoding of arguments on entry |

### Application Creation

```python
from algopy import ARC4Contract, arc4, String

class MyContract(ARC4Contract):
    def __init__(self) -> None:
        self.name = String()

    # CORRECT - Method that creates the application
    @arc4.abimethod(create="require")
    def create(self, name: arc4.String) -> None:
        self.name = name.native

    # CORRECT - Method that can optionally create
    @arc4.abimethod(create="allow")
    def initialize(self, name: arc4.String) -> None:
        self.name = name.native

    # CORRECT - Method that cannot create (default)
    @arc4.abimethod  # create="disallow" is default
    def update_name(self, name: arc4.String) -> None:
        self.name = name.native
```

### OnComplete Actions

```python
from algopy import ARC4Contract, arc4, Txn

class MyContract(ARC4Contract):
    @arc4.abimethod(allow_actions=["OptIn"])
    def opt_in(self) -> None:
        pass

    @arc4.abimethod(allow_actions=["UpdateApplication"])
    def update(self) -> None:
        assert Txn.sender == self.creator

    @arc4.abimethod(allow_actions=["NoOp", "OptIn"])  # Multiple actions
    def register(self) -> None:
        pass
```

Valid actions: `"NoOp"` (default), `"OptIn"`, `"CloseOut"`, `"UpdateApplication"`, `"DeleteApplication"`.

### Read-Only Methods

```python
from algopy import ARC4Contract, arc4, UInt64

class MyContract(ARC4Contract):
    def __init__(self) -> None:
        self.counter = UInt64(0)

    # CORRECT - Mark as read-only for simulation
    @arc4.abimethod(readonly=True)
    def get_counter(self) -> arc4.UInt64:
        return arc4.UInt64(self.counter)
```

### Custom Method Names

```python
from algopy import ARC4Contract, arc4

class MyContract(ARC4Contract):
    # CORRECT - Override ABI method name
    @arc4.abimethod(name="getBalance")
    def get_balance(self) -> arc4.UInt64:
        return arc4.UInt64(0)
```

### Default Arguments

```python
from algopy import ARC4Contract, arc4, Asset, Global

class MyContract(ARC4Contract):
    def __init__(self) -> None:
        self.asset = Asset()

    # CORRECT - Default arg from state or constant
    @arc4.abimethod(
        default_args={
            "asset": "asset",  # From self.asset
            "sender": "global.creator_address"  # From Global
        }
    )
    def transfer(self, asset: Asset, sender: arc4.Address) -> None:
        pass
```

## @arc4.baremethod

Marks a method as a bare method (no ABI selector, no arguments/return).

### Basic Usage

```python
from algopy import ARC4Contract, arc4

class MyContract(ARC4Contract):
    # CORRECT - Bare method for creation
    @arc4.baremethod(create="require")
    def create(self) -> None:
        pass

    # CORRECT - Bare method for opt-in
    @arc4.baremethod(allow_actions=["OptIn"])
    def opt_in(self) -> None:
        pass
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `create` | `"allow"`, `"require"`, `"disallow"` | `"disallow"` | Application creation behavior |
| `allow_actions` | `list[str]` | `["NoOp"]` | Allowed OnComplete actions |

Bare methods use the same `create` and `allow_actions` parameters as `@arc4.abimethod`. Common patterns:

```python
@arc4.baremethod(create="require")
def create(self) -> None: pass

@arc4.baremethod(allow_actions=["UpdateApplication"])
def update(self) -> None:
    assert Txn.sender == self.creator
```

## @subroutine

Marks a function as a reusable subroutine (internal, not callable externally).

### Basic Usage

```python
from algopy import ARC4Contract, arc4, UInt64, subroutine

class MyContract(ARC4Contract):
    @arc4.abimethod
    def calculate(self, value: arc4.UInt64) -> arc4.UInt64:
        result = self._double(value.native)
        return arc4.UInt64(result)

    # CORRECT - Private subroutine
    @subroutine
    def _double(self, value: UInt64) -> UInt64:
        return value * UInt64(2)
```

### Module-Level Subroutines

```python
from algopy import ARC4Contract, arc4, UInt64, subroutine

# CORRECT - Module-level subroutine
@subroutine
def calculate_fee(amount: UInt64) -> UInt64:
    return amount * UInt64(3) // UInt64(100)

class MyContract(ARC4Contract):
    @arc4.abimethod
    def process(self, amount: arc4.UInt64) -> arc4.UInt64:
        fee = calculate_fee(amount.native)
        return arc4.UInt64(fee)
```

### Inline Parameter

```python
@subroutine(inline=True)   # Force inlining (small, frequently called)
def is_valid(value: UInt64) -> bool:
    return value > UInt64(0)

@subroutine(inline=False)  # Prevent inlining (large, called multiple times)
def complex_calculation(a: UInt64, b: UInt64, c: UInt64) -> UInt64:
    return a * b + c

@subroutine  # Default: compiler decides
def helper(value: UInt64) -> UInt64:
    return value + UInt64(1)
```

## Lifecycle Methods

### __init__ (State Initialization)

```python
from algopy import ARC4Contract, UInt64, String

class MyContract(ARC4Contract):
    def __init__(self) -> None:
        # Initialize state - runs on application creation
        self.counter = UInt64(0)
        self.name = String("default")
```

### clear_state_program (Clear State)

```python
from algopy import ARC4Contract, UInt64

class MyContract(ARC4Contract):
    # CORRECT - Custom clear state logic
    def clear_state_program(self) -> UInt64:
        # Return 1 to approve, 0 to reject
        return UInt64(1)
```

## Events (ARC-28)

Emit structured events for off-chain indexing using `arc4.emit()`.

### Define Event Struct

```python
from algopy import ARC4Contract, arc4

class Swapped(arc4.Struct):
    a: arc4.UInt64
    b: arc4.UInt64
```

### Emit Events

```python
class EventEmitter(ARC4Contract):
    @arc4.abimethod
    def emit_swapped(self, a: arc4.UInt64, b: arc4.UInt64) -> None:
        arc4.emit(Swapped(b, a))  # Preferred: pass Struct instance
```

Alternatives: `arc4.emit("Swapped(uint64,uint64)", b, a)` (full signature) or `arc4.emit("Swapped", b, a)` (name only). Event name must be a compile-time constant.

## @logicsig (Logic Signatures)

Logic signatures are stateless programs implemented as decorated functions (not classes).

### Basic Usage

```python
from algopy import logicsig, Txn, Global, UInt64

@logicsig
def my_logic_sig() -> bool:
    # Approve if sender is the creator
    return Txn.sender == Global.creator_address
```

### Accessing Arguments

```python
from algopy import logicsig, op, Bytes

@logicsig
def hashed_time_locked() -> bool:
    secret = op.arg(0)  # Access argument by index
    expected_hash = op.sha256(Bytes(b"secret"))
    return op.sha256(secret) == expected_hash
```

### Getting Logic Signature Address

```python
from algopy import compile_logicsig

# Get the escrow address for a logic signature
compiled = compile_logicsig(my_logic_sig)
lsig_account = compiled.account  # Account address of the logic sig
```

### Key Constraints

- No `self` — logicsigs are functions, not methods
- Cannot access contract state (no `GlobalState`, `LocalState`, `Box`)
- 20,000 opcode budget (not poolable)
- Can use module-level `@subroutine` functions
- Return `bool` (True = approve) or `UInt64` (non-zero = approve)

## Method Visibility Summary

| Decorator | Externally Callable | Has ABI Selector | Can Have Args/Return |
|-----------|---------------------|------------------|----------------------|
| `@arc4.abimethod` | Yes | Yes | Yes |
| `@arc4.baremethod` | Yes | No | No |
| `@subroutine` | No | No | Yes |
| `@logicsig` | N/A (standalone program) | No | No (uses `op.arg`) |
| (no decorator) | No | No | Yes (internal only) |

## Common Mistakes

### Using abimethod for Internal Logic

```python
# INCORRECT - Internal logic exposed as ABI method
@arc4.abimethod
def _calculate_fee(self, amount: arc4.UInt64) -> arc4.UInt64:
    return arc4.UInt64(amount.native * UInt64(3) // UInt64(100))

# CORRECT - Use subroutine for internal logic
@subroutine
def _calculate_fee(self, amount: UInt64) -> UInt64:
    return amount * UInt64(3) // UInt64(100)
```

### Forgetting create Parameter for Creation Methods

```python
# INCORRECT - Cannot call this during creation
@arc4.abimethod
def create_app(self, name: arc4.String) -> None:
    self.name = name.native

# CORRECT - Explicitly allow or require creation
@arc4.abimethod(create="require")
def create_app(self, name: arc4.String) -> None:
    self.name = name.native
```

### Arguments on Bare Methods

```python
# INCORRECT - Bare methods cannot have arguments
@arc4.baremethod
def opt_in(self, user_name: arc4.String) -> None:  # Error!
    pass

# CORRECT - Use abimethod if you need arguments
@arc4.abimethod(allow_actions=["OptIn"])
def opt_in(self, user_name: arc4.String) -> None:
    pass

# CORRECT - Bare method without arguments
@arc4.baremethod(allow_actions=["OptIn"])
def opt_in(self) -> None:
    pass
```

### Missing Return Type on Subroutines

```python
# INCORRECT - Missing return type annotation
@subroutine
def calculate(value: UInt64):
    return value * UInt64(2)

# CORRECT - Include return type
@subroutine
def calculate(value: UInt64) -> UInt64:
    return value * UInt64(2)
```

### Using Native Types in ABI Method Signatures

```python
# INCORRECT - ABI methods should use arc4 types for args/return
@arc4.abimethod
def add(self, a: UInt64, b: UInt64) -> UInt64:
    return a + b

# CORRECT - Use arc4 types in signature
@arc4.abimethod
def add(self, a: arc4.UInt64, b: arc4.UInt64) -> arc4.UInt64:
    return arc4.UInt64(a.native + b.native)
```

## References

- [Algorand Python Contract Structure](https://dev.algorand.co/algokit/languages/python/lg-contract-structure/)
- [ARC-4 ABI Methods](https://dev.algorand.co/algokit/languages/python/lg-arc4/)
- [algopy API Reference](https://dev.algorand.co/reference/algorand-python/api/api-algopy/)
- [algopy.arc4 Reference](https://dev.algorand.co/reference/algorand-python/api/api-algopy-arc4/)
