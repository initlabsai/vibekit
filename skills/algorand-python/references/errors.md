# Smart Contract & Transaction Errors

Common errors when building, deploying, calling, and transacting on Algorand.

## Table of Contents

- [Logic Eval Errors](#logic-eval-errors)
- [ABI Errors](#abi-errors)
- [State Errors](#state-errors)
- [Inner Transaction Errors](#inner-transaction-errors)
- [Transaction Errors](#transaction-errors)
- [Asset Errors](#asset-errors)
- [Account Errors](#account-errors)
- [SDK Errors](#sdk-errors)
- [Application Errors](#application-errors)
- [PuyaPy Compiler Errors](#puyapy-compiler-errors)
- [Debugging Tips](#debugging-tips)

## Logic Eval Errors

### Assert Failed

```
logic eval error: assert failed pc=123
```

**Cause:** An `assert` statement evaluated to false.

**Debug with source maps (AlgoKit Utils):**

```python
from algokit_utils import LogicError

try:
    app_client.send.my_method(value=0)
except LogicError as e:
    print(e)       # Shows: assert failed at contracts/my_contract.py:45
    print(e.pc)    # Program counter: 123
    print(e.line)  # Source line number
    print(e.traces)  # Execution trace (if available)
```

**Common causes:**
- Input validation failed (e.g., `assert amount > 0`)
- Authorization check failed (e.g., `assert Txn.sender == self.owner`)
- State precondition not met (e.g., `assert self.is_initialized`)

**Fix:** Check the assertion condition and ensure inputs satisfy it.

### Opcode Budget Exceeded

```
logic eval error: dynamic cost budget exceeded
```

**Cause:** Contract exceeded the 700 opcode budget per app call.

**Budget limits:** 700 per app call, poolable to 11,200 (16 app calls). See [avm-resource-limits.md](../../algorand-core/references/avm-resource-limits.md) for full details.

**Solutions:**

1. **Pool budget with extra app calls:**
```python
# Add dummy app calls to increase budget
algorand.new_group()
    .add_app_call_method_call(actual_call_params)
    .add_app_call(AppCallParams(
        sender=sender,
        app_id=app_id,
        on_complete=OnComplete.NoOp,
        args=[b"noop"]  # Dummy call for budget
    ))
    .send()
```

2. **Optimize expensive operations:**
```python
# EXPENSIVE - iteration over large data
for i in range(100):
    process(data[i])

# CHEAPER - batch operations or use Box storage
box_data = Box(Bytes, key=b"data")
```

3. **Split across multiple calls:**
```python
# Instead of one large operation, split into phases
@arc4.abimethod
def process_phase1(self) -> None: ...

@arc4.abimethod
def process_phase2(self) -> None: ...
```

### Invalid Program

```
logic eval error: invalid program
```

**Cause:** The TEAL program is malformed or uses unsupported opcodes.

**Common causes:**
- Compiling for wrong AVM version
- Using opcodes not supported on target network
- Corrupted approval/clear program bytes

**Fix:** Ensure compilation targets the correct AVM version.

### Stack Underflow

```
logic eval error: stack underflow
```

**Cause:** Operation tried to pop from empty stack.

**In Algorand Python:** This usually indicates a bug in low-level operations. Check any `op.*` calls.

### Byte/Int Type Mismatch

```
logic eval error: assert failed: wanted type uint64 but got []byte
```

**Cause:** Wrong type passed to an operation.

**Common in Algorand Python:**
```python
# INCORRECT - String where UInt64 expected
assert payment.amount == "1000000"

# CORRECT - Use proper types
assert payment.amount == UInt64(1_000_000)
```

## ABI Errors

### Method Not Found

```
error: method "foo(uint64)void" not found
```

**Cause:** Calling a method that doesn't exist in the contract ABI.

**Fix:**
1. Regenerate the typed client after contract changes
2. Check the method signature matches exactly
3. Verify the contract was deployed with the latest code

### ABI Encoding Error

```
ABIEncodingError: value out of range for uint64
```

**Cause:** Value doesn't fit the ABI type.

**Examples:**
```python
# INCORRECT - Negative value for uint64
arc4.UInt64(-1)

# INCORRECT - Value too large
arc4.UInt8(256)  # Max is 255

# CORRECT - Use appropriate type
arc4.UInt64(0)
arc4.UInt16(256)
```

### Return Value Decoding Error

```
error: could not decode return value
```

**Cause:** Method returned unexpected data format.

**Common causes:**
- Contract didn't log the return value properly
- Wrong return type in client
- Transaction failed before return

**Fix:** Check contract method has correct return annotation.

## State Errors

### Global State Full

```
logic eval error: store global state: failed
```

**Cause:** Exceeded declared global state schema.

**Fix:** Increase schema in contract deployment:
```python
class MyContract(ARC4Contract):
    # Declare more state slots in schema
    @arc4.abimethod(create=True)
    def create(self) -> None:
        pass
```

### Local State Not Opted In

```
logic eval error: application APPID not opted in
```

**Cause:** Account hasn't opted into the application.

**Fix:** Opt in before accessing local state:
```python
algorand.send.app_call(AppCallParams(
    sender=user_address,
    app_id=app_id,
    on_complete=OnComplete.OptIn,
))
```

### Box Not Found

```
logic eval error: box not found
```

**Cause:** Accessing a box that doesn't exist.

**Fix:** Create box before access or check existence:
```python
# In contract - check if box exists
if self.my_box.exists:
    value = self.my_box.value
else:
    self.my_box.value = default_value
```

### Box MBR Not Met

```
logic eval error: box create with insufficient funds
```

**Cause:** App account lacks funds for box minimum balance requirement.

**MBR formula:** `2500 + (400 * (key_length + value_length))` microAlgos per box

**Fix:** Fund the app account:
```python
algorand.send.payment(PaymentParams(
    sender=funder.address,
    receiver=app_client.app_address,
    amount=AlgoAmount(algo=1),  # Cover box MBR
))
```

## Inner Transaction Errors

### Insufficient Balance for Inner Txn

```
logic eval error: insufficient balance
```

**Cause:** App account lacks funds for inner transaction amount.

**Fix:** Fund the app account before inner transactions:
```python
# Fund app before calling method with inner transactions
algorand.send.payment(PaymentParams(
    sender=deployer.address,
    receiver=app_client.app_address,
    amount=AlgoAmount(algo=5),
))
```

### Inner Transaction Limit

```
logic eval error: too many inner transactions
```

**Cause:** Exceeded 256 inner transactions per group.

**Fix:** Split operations across multiple outer transactions.

### App Not Opted Into Asset

```
logic eval error: asset ASSET_ID not opted in
```

**Cause:** Contract account isn't opted into the asset.

**Fix:** Add opt-in method to contract:
```python
@arc4.abimethod
def opt_in_to_asset(self, asset: Asset) -> None:
    itxn.AssetTransfer(
        xfer_asset=asset,
        asset_receiver=Global.current_application_address,
        asset_amount=0,
        fee=0
    ).submit()
```

## Transaction Errors

### Overspend

```
TransactionPool.Remember: transaction TXID: overspend (account ADDRESS, data {_struct:{} Status:Offline MicroAlgos:{Raw:1000} ...})
```

**Cause:** Sender account has insufficient balance for amount + fee + minimum balance.

See [avm-resource-limits.md](../../algorand-core/references/avm-resource-limits.md) for MBR formulas.

**Fix:** Fund the sender account or account for MBR when calculating available balance:

```python
# Calculate available balance
account_info = algorand.account.get_information(address)
available = account_info.amount - account_info.min_balance
```

### Transaction Already in Ledger

```
TransactionPool.Remember: transaction already in ledger: TXID
```

**Cause:** Duplicate transaction submitted (same txn ID).

**Common causes:**
- Retrying a transaction that already succeeded
- Using same lease within validity window
- Network latency causing duplicate submission

**Fix:** Check if transaction exists before retrying.

### Transaction Pool Full

```
TransactionPool.Remember: transaction pool is full
```

**Cause:** Node's transaction pool at capacity.

**Fix:**
1. Wait and retry with exponential backoff
2. Increase fee to prioritize transaction
3. Try a different node

### Fee Too Low

```
TransactionPool.Remember: transaction TXID: fee X below threshold Y
```

**Cause:** Transaction fee below minimum (usually 1000 microAlgo).

**Fix:**
```python
algorand.send.payment(PaymentParams(
    sender=sender,
    receiver=receiver,
    amount=AlgoAmount(algo=1),
    static_fee=AlgoAmount(micro_algo=1000),  # Minimum fee
))
```

### Round Out of Range

```
TransactionPool.Remember: transaction TXID: round X outside of Y-Z range
```

**Cause:** Transaction's validity window expired or is in the future.

**Fix:** Set appropriate validity window when creating transactions.

### Invalid Group

```
TransactionPool.Remember: transaction TXID: bad group assignment
```

**Cause:** Transaction claims to be part of a group but has wrong group ID.

**Fix:** Use AlgoKit Utils for proper grouping:
```python
algorand.new_group()
    .add_payment(PaymentParams(sender=sender, receiver=receiver, amount=AlgoAmount(algo=1)))
    .add_asset_opt_in(AssetOptInParams(sender=sender, asset_id=12345))
    .send()
```

### Group Size Limit

```
cannot send transaction group with more than 16 transactions
```

**Cause:** Transaction group exceeds 16 transaction limit.

**Fix:** Split into multiple groups or optimize to fewer transactions.

## Asset Errors

### Asset Not Found

```
asset ASSET_ID does not exist
```

**Cause:** Asset ID doesn't exist on the network.

**Common causes:**
- Wrong network (TestNet vs MainNet)
- Asset was deleted
- Typo in asset ID

### Asset Not Opted In

```
asset ASSET_ID missing from ACCOUNT_ADDRESS
```

**Cause:** Receiving account hasn't opted into the asset.

**Fix:** Opt in before transfer:
```python
algorand.send.asset_opt_in(AssetOptInParams(
    sender=receiver_address,
    asset_id=asset_id,
))
```

### Asset Frozen

```
asset ASSET_ID frozen in ACCOUNT_ADDRESS
```

**Cause:** Account's holding of this asset is frozen.

**Fix:** Asset freeze manager must unfreeze the account.

### Clawback Not Authorized

```
only clawback address can clawback
```

**Cause:** Attempting clawback without being the clawback address.

### Cannot Close Asset

```
cannot close asset: ACCOUNT_ADDRESS still has X units
```

**Cause:** Trying to opt out while still holding units.

**Fix:** Transfer all units before opting out:
```python
# First transfer all units
algorand.send.asset_transfer(AssetTransferParams(
    sender=account,
    receiver=creator_or_other,
    asset_id=asset_id,
    amount=balance,  # All remaining
))

# Then opt out
algorand.send.asset_opt_out(AssetOptOutParams(
    sender=account,
    asset_id=asset_id,
    creator=creator_address,
))
```

## Account Errors

### Account Not Found

```
account ADDRESS not found
```

**Cause:** Account doesn't exist (never funded).

**Note:** Algorand accounts must receive at least minimum balance to exist.

**Fix:** Fund the account:
```python
algorand.send.payment(PaymentParams(
    sender=funder.address,
    receiver=new_account.address,
    amount=AlgoAmount(micro_algo=100_000),  # Minimum
))
```

### Invalid Address

```
invalid address: ADDRESS
```

**Cause:** Malformed Algorand address. Valid addresses are 58 characters, Base32 encoded, with checksum.

### Wrong Network

```
genesis hash mismatch
```

**Cause:** Transaction built for different network than target.

**Fix:** Ensure AlgorandClient connects to correct network:
```python
algorand = AlgorandClient.testnet()   # For TestNet
algorand = AlgorandClient.mainnet()   # For MainNet
```

## SDK Errors

### AlgodHTTPError

```
AlgodHTTPError: Network request error. Received status 401
```

**Common status codes:**
| Status | Meaning | Fix |
|--------|---------|-----|
| 401 | Unauthorized | Check API token |
| 404 | Not found | Check server URL |
| 500 | Server error | Node issue, retry |
| 503 | Unavailable | Node overloaded, retry |

**Fix for 401:**
```python
algorand = AlgorandClient.from_config(
    algod_config=AlgoClientNetworkConfig(
        server="https://testnet-api.algonode.cloud",
        port="443",
        token="",  # AlgoNode doesn't require token
    )
)
```

### Timeout Waiting for Confirmation

```
Timeout waiting for transaction TXID to be confirmed
```

**Cause:** Transaction not confirmed within wait rounds.

**Possible reasons:**
- Transaction rejected (check node logs)
- Fee too low during congestion
- Network issues

### Connection Refused

```
fetch failed: ECONNREFUSED
```

**Cause:** Cannot connect to Algorand node.

**Fix:**
1. For LocalNet: Ensure AlgoKit LocalNet is running (`algokit localnet start`)
2. For public networks: Check internet connection
3. Verify server URL is correct

## Application Errors

### Application Not Found

```
application APPID does not exist
```

**Cause:** App ID doesn't exist on the network.

### Not Opted Into Application

```
address ADDRESS has not opted in to application APPID
```

**Cause:** Account trying to access local state without opt-in.

**Fix:**
```python
algorand.send.app_call(AppCallParams(
    sender=user_address,
    app_id=app_id,
    on_complete=OnComplete.OptIn,
))
```

### Application Creator Only

```
cannot update or delete application: only creator can modify
```

**Cause:** Attempting to modify app without being creator.

**Fix:** Only the app creator can update/delete. Check creator:
```python
app_info = algorand.app.get_by_id(app_id)
if sender != app_info.creator:
    raise Error("Only creator can modify")
```

## PuyaPy Compiler Errors

### Missing Type Annotations

```
error: missing return type annotation
```

**Cause:** All functions and methods in Algorand Python require explicit type annotations.

**Fix:**
```python
# INCORRECT
@subroutine
def calculate(value):
    return value * UInt64(2)

# CORRECT
@subroutine
def calculate(value: UInt64) -> UInt64:
    return value * UInt64(2)
```

### Unsupported Python Features

```
error: unsupported Python feature: try/except
```

**Cause:** Algorand Python only supports a subset of Python. Many standard constructs are not available on the AVM.

**Unsupported features:**
- `try/except/finally`
- `with` statements
- `yield` / generators
- `async/await`
- `class` inheritance (except from `ARC4Contract` or `Contract`)
- `dict`, `list`, `set` (use `Box`, `BoxMap`, `DynamicArray`)

### Invalid Type for AVM

```
error: Python int is not supported, use UInt64
```

**Cause:** Native Python types cannot be used as local variables or state — only as module-level constants.

**Fix:**
```python
# INCORRECT - Python int as local variable
@arc4.abimethod
def bad(self) -> None:
    x: int = 5  # Error

# CORRECT - Use AVM types
@arc4.abimethod
def good(self) -> None:
    x = UInt64(5)
```

### Native Types in ABI Signatures

```
error: UInt64 is not a valid ARC-4 type for method parameters
```

**Cause:** ABI method parameters and return types must use `arc4` types, not native AVM types.

**Fix:**
```python
# INCORRECT - native types in ABI signature
@arc4.abimethod
def add(self, a: UInt64, b: UInt64) -> UInt64:
    return a + b

# CORRECT - use arc4 types
@arc4.abimethod
def add(self, a: arc4.UInt64, b: arc4.UInt64) -> arc4.UInt64:
    return arc4.UInt64(a.native + b.native)
```

### External Imports

```
error: cannot import from external package
```

**Cause:** Algorand Python can only import from `algopy` and local contract modules. Standard library and third-party packages are not available.

**Fix:** Only use `algopy` imports and local modules:
```python
# INCORRECT
import hashlib  # Error: external package

# CORRECT
from algopy import op
hash_result = op.sha256(data)
```

### Undecorated Functions

```
error: function must be decorated with @subroutine
```

**Cause:** Module-level functions used by contracts must be decorated with `@subroutine`.

**Fix:**
```python
# INCORRECT
def helper(value: UInt64) -> UInt64:
    return value * UInt64(2)

# CORRECT
@subroutine
def helper(value: UInt64) -> UInt64:
    return value * UInt64(2)
```

## Debugging Tips

### Catch and Inspect LogicError

```python
from algokit_utils import LogicError

try:
    app_client.send.my_method(value=0)
except LogicError as e:
    print(f"PC: {e.pc}, Line: {e.line}, Traces: {e.traces}")
```

### Simulate Before Sending

```python
result = app_client.new_group().my_method(value=42).simulate()
print(result.simulate_response)
```

### Debugging Workflow

1. **Read the error** — `pc=N` maps to source via source maps (`LogicError.line`)
2. **Simulate** — `.simulate()` for execution trace without committing
3. **Inspect on Lora** — [lora.algokit.io](https://lora.algokit.io) for transaction details
4. **Verify balances** — ensure sufficient funds for MBR + fees + amount

## References

- [Debugging Smart Contracts](https://dev.algorand.co/concepts/smart-contracts/debugging/)
- [AVM Opcodes Reference](https://dev.algorand.co/reference/teal/opcodes/)
- [Transaction Structure](https://dev.algorand.co/concepts/transactions/structure/)
- [Account Management](https://dev.algorand.co/concepts/accounts/)
- [Asset Overview](https://dev.algorand.co/concepts/assets/)

> **See also:** `algorand-core` skill ([avm-resource-limits.md](../../algorand-core/references/avm-resource-limits.md)) for complete AVM limits, MBR formulas, and budget pooling details.
