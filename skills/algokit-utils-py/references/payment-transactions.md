## Payment transactions

> All snippets in this section assume an `AlgorandClient` named `algorand` —
> see [Client initialization](#client-initialization) for setup.

### Send a simple payment

Transfer Algo from one account to another.

```python
from algokit_utils import AlgorandClient, PaymentParams, AlgoAmount

algorand = AlgorandClient.default_localnet()

sender = algorand.account.random()
receiver = algorand.account.random()
algorand.account.ensure_funded(sender, algorand.account.localnet_dispenser(), AlgoAmount(algo=10))

result = algorand.send.payment(PaymentParams(
    sender=sender.addr,
    receiver=receiver.addr,
    amount=AlgoAmount(algo=4),
))
```

**What just happened:** `algorand.send.payment()` built, signed, and submitted a payment transaction that transfers 4 Algo from `sender` to `receiver`. The returned `result` contains the transaction ID and confirmation details.

### Create an unsigned payment

Build a payment transaction without signing or sending it.

```python
txn = algorand.create_transaction.payment(PaymentParams(
    sender=sender.addr,
    receiver=receiver.addr,
    amount=AlgoAmount(algo=2),
))
```

**What just happened:** `algorand.create_transaction.payment()` returned a raw `Transaction` object you can inspect, serialize, or sign manually. Nothing was sent to the network.

### Send a payment with a note

Attach arbitrary data to a payment using the `note` field.

```python
result = algorand.send.payment(PaymentParams(
    sender=sender.addr,
    receiver=receiver.addr,
    amount=AlgoAmount(algo=1),
    note=b"Hello from AlgoKit!",
))
```

**What just happened:** The `note` field accepts `bytes` (max 1 000 bytes). The note is stored on-chain and visible to anyone inspecting the transaction.

### Send a payment with a lease

Prevent duplicate transactions within a validity window using a lease.

```python
result = algorand.send.payment(PaymentParams(
    sender=sender.addr,
    receiver=receiver.addr,
    amount=AlgoAmount(algo=1),
    lease=b"unique-invoice-001",
))
```

**What just happened:** The `lease` field ensures that only one transaction with this lease value from the same sender can be confirmed within the validity window. This is useful for preventing accidental double-payments.

### Send a payment with explicit fee control

Override the suggested fee or cap the maximum fee you are willing to pay.

```python
# Set a static fee (replaces the suggested fee entirely)
result1 = algorand.send.payment(PaymentParams(
    sender=sender.addr,
    receiver=receiver.addr,
    amount=AlgoAmount(algo=1),
    static_fee=AlgoAmount(micro_algo=2000),
))

# Add an extra fee on top of the suggested fee (useful for covering inner txn fees)
result2 = algorand.send.payment(PaymentParams(
    sender=sender.addr,
    receiver=receiver.addr,
    amount=AlgoAmount(algo=1),
    extra_fee=AlgoAmount(micro_algo=1000),
))

# Cap the fee to prevent overspending during congestion
result3 = algorand.send.payment(PaymentParams(
    sender=sender.addr,
    receiver=receiver.addr,
    amount=AlgoAmount(algo=1),
    max_fee=AlgoAmount(micro_algo=3000),
))
```

**What just happened:** `static_fee` sets an exact fee, `extra_fee` adds to the network-suggested fee (handy when your outer transaction must cover fees for inner transactions), and `max_fee` throws an error if the calculated fee exceeds the cap — protecting you from overspending during congestion.

### Close an account

Send an account's entire remaining balance to another address.

```python
result = algorand.send.payment(PaymentParams(
    sender=account_to_close.addr,
    receiver=receiver.addr,
    amount=AlgoAmount(micro_algo=0),
    close_remainder_to=receiver.addr,
))
```

**What just happened:** Setting `close_remainder_to` transfers all remaining Algo from the sender to the specified address after the transaction executes. The `amount` can be `0` — the protocol moves the full balance minus the fee. After confirmation, the sender's account is emptied on-chain.
