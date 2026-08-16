# Algorand Python Transactions

## Contents

- [Transaction Types Overview](#transaction-types-overview)
- [Inner Transactions](#inner-transactions)
- [Grouped Inner Transactions](#grouped-inner-transactions)
- [Inner Transaction Result Properties](#inner-transaction-result-properties)
- [Group Transactions](#group-transactions)
- [Fee Pooling (CRITICAL)](#fee-pooling-critical)
- [Common Mistakes](#common-mistakes)
- [Calling Other Contracts (ARC-4)](#calling-other-contracts-arc-4)
- [ensure_budget](#ensure_budget)
- [Complete Example: Escrow Payment](#complete-example-escrow-payment)
- [References](#references)

Create inner transactions and access group transactions in Algorand Python smart contracts.

## Transaction Types Overview

| Group Transactions | Inner Transaction Params | Inner Transaction Result |
|-------------------|--------------------------|--------------------------|
| `gtxn.PaymentTransaction` | `itxn.Payment` | `PaymentInnerTransaction` |
| `gtxn.AssetTransferTransaction` | `itxn.AssetTransfer` | `AssetTransferInnerTransaction` |
| `gtxn.AssetConfigTransaction` | `itxn.AssetConfig` | `AssetConfigInnerTransaction` |
| `gtxn.AssetFreezeTransaction` | `itxn.AssetFreeze` | `AssetFreezeInnerTransaction` |
| `gtxn.ApplicationCallTransaction` | `itxn.ApplicationCall` | `ApplicationCallInnerTransaction` |
| `gtxn.KeyRegistrationTransaction` | `itxn.KeyRegistration` | `KeyRegistrationInnerTransaction` |
| `gtxn.Transaction` | `itxn.InnerTransaction` | `InnerTransactionResult` |

## Inner Transactions

Smart contracts can execute inner transactions to send payments, transfer assets, create assets, and call other applications.

### Basic Payment

```python
from algopy import ARC4Contract, UInt64, Txn, itxn, arc4

class MyContract(ARC4Contract):
    @arc4.abimethod
    def send_payment(self) -> UInt64:
        # Create and submit a payment inner transaction
        result = itxn.Payment(
            amount=5000,
            receiver=Txn.sender,
            fee=0  # Always use 0 - caller covers via fee pooling
        ).submit()

        return result.amount
```

### Asset Transfer

```python
from algopy import ARC4Contract, Asset, Account, UInt64, itxn, arc4

class MyContract(ARC4Contract):
    @arc4.abimethod
    def transfer_asset(self, asset: Asset, receiver: Account, amount: UInt64) -> None:
        itxn.AssetTransfer(
            xfer_asset=asset,
            asset_receiver=receiver,
            asset_amount=amount,
            fee=0
        ).submit()
```

### Asset Opt-In (Self Transfer)

```python
from algopy import ARC4Contract, Asset, Global, itxn, arc4

class MyContract(ARC4Contract):
    @arc4.abimethod
    def opt_in_to_asset(self, asset: Asset) -> None:
        # Opt the contract into an asset
        itxn.AssetTransfer(
            xfer_asset=asset,
            asset_receiver=Global.current_application_address,
            asset_amount=0,
            fee=0
        ).submit()
```

### Create Fungible Asset

```python
from algopy import ARC4Contract, UInt64, Global, itxn, arc4

class MyContract(ARC4Contract):
    @arc4.abimethod
    def create_token(self) -> UInt64:
        result = itxn.AssetConfig(
            total=100_000_000_000,
            decimals=2,
            unit_name=b"TKN",
            asset_name=b"My Token",
            manager=Global.current_application_address,
            reserve=Global.current_application_address,
            fee=0
        ).submit()

        return result.created_asset.id
```

### Create NFT

```python
from algopy import ARC4Contract, UInt64, Global, itxn, arc4

class MyContract(ARC4Contract):
    @arc4.abimethod
    def create_nft(self) -> UInt64:
        # ARC-3 NFT: total=1, decimals=0
        result = itxn.AssetConfig(
            total=1,
            decimals=0,
            unit_name=b"NFT",
            asset_name=b"My NFT",
            url=b"https://example.com/nft.json",
            manager=Global.current_application_address,
            reserve=Global.current_application_address,
            freeze=Global.current_application_address,
            clawback=Global.current_application_address,
            fee=0
        ).submit()

        return result.created_asset.id
```

> **CRITICAL LIMITATION:** You **cannot** create an asset and transfer it to the caller (`Txn.sender`) in the same method call. The caller hasn't opted into the asset (which doesn't exist until mid-execution), and opt-in can't happen mid-execution. **Design pattern:** Use a two-step flow — (1) create the asset and hold it in the contract, (2) caller opts in, then (3) a separate method transfers the asset.

### Call Another Application

```python
from algopy import ARC4Contract, Application, Bytes, arc4, itxn

class MyContract(ARC4Contract):
    @arc4.abimethod
    def call_other_app(self, app: Application) -> arc4.String:
        # Call an ARC-4 method on another app
        result = itxn.ApplicationCall(
            app_id=app,
            app_args=(
                arc4.arc4_signature("hello(string)string"),
                arc4.String("World")
            ),
            fee=0
        ).submit()

        # Extract return value from logs
        return arc4.String.from_log(result.last_log)
```

### Deploy Another Contract

```python
from algopy import ARC4Contract, UInt64, arc4, itxn, compile_contract
from .other_contract import OtherContract

class MyContract(ARC4Contract):
    @arc4.abimethod
    def deploy_contract(self) -> UInt64:
        # Compile and deploy another contract
        compiled = compile_contract(OtherContract)

        result = itxn.ApplicationCall(
            approval_program=compiled.approval_program,
            clear_state_program=compiled.clear_state_program,
            fee=0
        ).submit()

        return result.created_app.id

    @arc4.abimethod
    def deploy_with_arc4(self) -> UInt64:
        # Simpler: use arc4.arc4_create
        result = arc4.arc4_create(OtherContract)
        return result.created_app.id
```

## Grouped Inner Transactions

Submit multiple inner transactions atomically using `itxn.submit_txns()`.

```python
from algopy import ARC4Contract, Application, UInt64, Txn, arc4, itxn

class MyContract(ARC4Contract):
    @arc4.abimethod
    def multi_txn(self, app: Application) -> tuple[UInt64, arc4.String]:
        # Create transaction parameters (not submitted yet)
        payment_params = itxn.Payment(
            amount=5000,
            receiver=Txn.sender,
            fee=0
        )

        app_call_params = itxn.ApplicationCall(
            app_id=app,
            app_args=(
                arc4.arc4_signature("hello(string)string"),
                arc4.String("World")
            ),
            fee=0
        )

        # Submit both atomically
        pay_txn, app_txn = itxn.submit_txns(payment_params, app_call_params)

        # Access results
        hello_result = arc4.String.from_log(app_txn.last_log)
        return pay_txn.amount, hello_result
```

### Inner Transactions in Loops

```python
from algopy import ARC4Contract, Account, UInt64, itxn, arc4

class MyContract(ARC4Contract):
    @arc4.abimethod
    def distribute(self, receivers: tuple[Account, Account, Account]) -> None:
        for receiver in receivers:
            itxn.Payment(
                amount=UInt64(1_000_000),
                receiver=receiver,
                fee=0
            ).submit()
```

## Inner Transaction Result Properties

All results share `sender`, `txn_id`, `fee`. Type-specific properties:

| Result Type | Key Properties |
|------------|----------------|
| Payment | `amount`, `receiver`, `close_remainder_to` |
| AssetConfig | `created_asset`, `config_asset` |
| AssetTransfer | `asset_amount`, `asset_receiver`, `xfer_asset` |
| ApplicationCall | `created_app`, `last_log`, `logs(index)` |

## Group Transactions

Access other transactions in an atomic group.

### As ABI Method Parameters

```python
from algopy import ARC4Contract, arc4, gtxn, Txn, Global

class MyContract(ARC4Contract):
    @arc4.abimethod
    def process_payment(self, payment: gtxn.PaymentTransaction) -> None:
        # Verify payment is to this app
        assert payment.receiver == Global.current_application_address
        assert payment.amount >= 1_000_000

        # Process the payment...
```

### By Group Index

```python
from algopy import ARC4Contract, arc4, gtxn, UInt64, Global

class MyContract(ARC4Contract):
    @arc4.abimethod
    def verify_group(self) -> None:
        # Access transaction at specific index
        pay_txn = gtxn.PaymentTransaction(0)

        assert pay_txn.receiver == Global.current_application_address
        assert pay_txn.amount >= UInt64(1_000_000)
```

### Untyped Access

```python
from algopy import ARC4Contract, arc4, gtxn, UInt64

class MyContract(ARC4Contract):
    @arc4.abimethod
    def check_any_txn(self, index: UInt64) -> None:
        # Access any transaction type
        txn = gtxn.Transaction(index)

        # Access common properties
        sender = txn.sender
        fee = txn.fee
        txn_type = txn.type
```

## Fee Pooling (CRITICAL)

Always set `fee=0` for inner transactions. The caller covers all fees through fee pooling.

```python
# CORRECT - Caller covers fees
itxn.Payment(
    amount=1000,
    receiver=Txn.sender,
    fee=0  # Always 0
).submit()

# INCORRECT - App pays fees (security risk!)
itxn.Payment(
    amount=1000,
    receiver=Txn.sender,
    fee=1000  # Don't do this!
).submit()
```

**Why?** If inner transactions specify non-zero fees, malicious callers can drain the app account by repeatedly invoking methods that execute inner transactions.

## Common Mistakes

### Forgetting Fee Pooling

```python
# INCORRECT - App pays fee (vulnerability!)
@arc4.abimethod
def bad_payment(self) -> None:
    itxn.Payment(
        amount=1000,
        receiver=Txn.sender
        # fee defaults to minimum, draining app account
    ).submit()

# CORRECT - Caller pays via fee pooling
@arc4.abimethod
def good_payment(self) -> None:
    itxn.Payment(
        amount=1000,
        receiver=Txn.sender,
        fee=0  # Explicit: caller covers
    ).submit()
```

### Not Checking Group Transaction Properties

```python
# INCORRECT - Trusts payment without verification
@arc4.abimethod
def accept_payment(self, payment: gtxn.PaymentTransaction) -> None:
    self.balance += payment.amount  # Who received it?

# CORRECT - Verify payment destination
@arc4.abimethod
def accept_payment_safe(self, payment: gtxn.PaymentTransaction) -> None:
    assert payment.receiver == Global.current_application_address
    self.balance += payment.amount
```

### Wrong Sender for Inner Transactions

```python
# Inner transactions are always sent from the app address
# The sender is automatically Global.current_application_address
# You cannot send from arbitrary accounts (unless rekeyed to app)

# CORRECT - Default sender is app address
itxn.Payment(
    amount=1000,
    receiver=some_account,
    fee=0
).submit()

# To send from a different account, it must be rekeyed to app
itxn.Payment(
    sender=rekeyed_account,  # Must be rekeyed to app address
    amount=1000,
    receiver=some_account,
    fee=0
).submit()
```

### Not Funding App Before Inner Transactions

Fund the app account before executing inner transactions (client-side payment to `app_client.app_address`).

### Using Wrong Index for Group Transactions

```python
# INCORRECT - Hardcoded index may be wrong
payment = gtxn.PaymentTransaction(0)

# CORRECT - Use transaction parameter (ARC-4 router resolves index)
def process(self, payment: gtxn.PaymentTransaction) -> None:
    assert payment.receiver == Global.current_application_address
```

## Calling Other Contracts (ARC-4)

### arc4.abi_call

```python
from algopy import ARC4Contract, Application, String, arc4, subroutine

class HelloWorld(ARC4Contract):
    @arc4.abimethod
    def greet(self, name: String) -> String:
        return "Hello " + name

@subroutine
def call_hello(app: Application) -> None:
    # Reference an Algorand Python method directly (type-safe)
    greeting, txn = arc4.abi_call(HelloWorld.greet, "there", app_id=app)
    assert greeting == "Hello there"
```

### Alternative: Method Signature

```python
@subroutine
def call_by_signature(app: Application) -> None:
    # Using method signature string
    result, txn = arc4.abi_call[arc4.String](
        "greet(string)string",
        arc4.String("World"),
        app_id=app,
    )

    # Using method name only (signature inferred)
    result, txn = arc4.abi_call[arc4.String](
        "greet",
        "World",
        app_id=app,
    )
```

### arc4.arc4_create

```python
from algopy import arc4, subroutine

@subroutine
def create_new_app() -> None:
    # Create a new app (automatically includes approval + clear programs)
    hello_world_app = arc4.arc4_create(HelloWorld).created_app

    # Then call it
    greeting, _txn = arc4.abi_call(
        HelloWorld.greet, "there", app_id=hello_world_app
    )
    assert greeting == "Hello there"
```

### arc4.arc4_update

```python
from algopy import arc4, Application, subroutine

@subroutine
def update_app(app: Application) -> None:
    # Update an existing app's programs
    arc4.arc4_update(HelloWorld, app_id=app)
```

### Calling Without Return Value

```python
@subroutine
def call_void_method(app: Application) -> None:
    # When method returns void, result is just the inner transaction
    txn = arc4.abi_call(OtherContract.set_value, arc4.UInt64(42), app_id=app)
```

## ensure_budget

Ensure sufficient opcode budget for expensive operations:

```python
from algopy import ARC4Contract, arc4, ensure_budget, OpUpFeeSource

class MyContract(ARC4Contract):
    @arc4.abimethod
    def expensive_operation(self) -> None:
        # Ensure at least 2000 opcodes are available
        # Uses GroupCredit: caller must include extra app calls in group
        ensure_budget(2000, fee_source=OpUpFeeSource.GroupCredit)

        # ... expensive computation ...
```

**Fee sources:**
| Source | Description |
|--------|-------------|
| `OpUpFeeSource.GroupCredit` | Uses fee credit from group transactions (caller pays) |
| `OpUpFeeSource.AppAccount` | App account pays for budget increase (avoid — drains app) |

## Complete Example: Escrow Payment

```python
from algopy import (
    ARC4Contract, Account, Global, Txn, UInt64, String,
    arc4, gtxn, itxn, subroutine,
)


class Escrow(ARC4Contract):
    def __init__(self) -> None:
        self.seller = Account()
        self.price = UInt64(0)
        self.is_active = UInt64(0)

    @arc4.abimethod(create="require")
    def create(self, seller: Account, price: arc4.UInt64) -> None:
        self.seller = seller
        self.price = price.native
        self.is_active = UInt64(1)

    @arc4.abimethod
    def buy(self, payment: gtxn.PaymentTransaction) -> None:
        # Verify escrow is active
        assert self.is_active

        # Verify payment goes to this app
        assert payment.receiver == Global.current_application_address
        assert payment.amount >= self.price

        # Pay the seller via inner transaction
        itxn.Payment(
            receiver=self.seller,
            amount=self.price,
            fee=0,  # Caller covers via fee pooling
        ).submit()

        self.is_active = UInt64(0)
```

## References

- [Algorand Python Transactions](https://dev.algorand.co/algokit/languages/python/lg-transactions/)
- [Inner Transactions Concepts](https://dev.algorand.co/concepts/smart-contracts/inner-txn/)
- [Calling Other Applications](https://dev.algorand.co/algokit/languages/python/lg-calling-apps/)
- [algopy.itxn API](https://dev.algorand.co/reference/algorand-python/api/api-algopyitxn/)
- [algopy.gtxn API](https://dev.algorand.co/reference/algorand-python/api/api-algopygtxn/)
