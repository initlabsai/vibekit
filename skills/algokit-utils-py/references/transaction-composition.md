## Transaction composition (atomic groups)

> All snippets in this section assume an `AlgorandClient` named `algorand` — see
> [Client initialization](#client-initialization) for setup.

### Create a transaction group

Start composing an atomic group of transactions.

```python
from algokit_utils import AlgorandClient

algorand = AlgorandClient.default_localnet()

composer = algorand.new_group()
```

**What just happened:** `algorand.new_group()` creates a new `TransactionComposer` instance. Every transaction you add to this composer will be submitted as a single atomic group — they all succeed together or all fail together.

### Add multiple transactions to a group

Combine a payment and an asset transfer into one atomic group.

```python
from algokit_utils import PaymentParams, AssetTransferParams
from algokit_utils.models.amount import AlgoAmount

result = (
    algorand.new_group()
    .add_payment(
        PaymentParams(sender=alice.addr, receiver=bob.addr, amount=AlgoAmount(algo=1))
    )
    .add_asset_transfer(
        AssetTransferParams(sender=alice.addr, receiver=bob.addr, asset_id=12345, amount=100)
    )
    .send()
)

print(f"Group ID: {result.group_id}")
print(f"Transaction IDs: {result.tx_ids}")
```

**What just happened:** Each `add_payment()` and `add_asset_transfer()` call returns the composer for fluent chaining. When you call `.send()`, both transactions are grouped, signed, and submitted atomically — the payment and asset transfer either both confirm or both fail.

### Multi-signer group

Different transactions in a group can have different signers.

```python
from algokit_utils import PaymentParams
from algokit_utils.models.amount import AlgoAmount

alice = algorand.account.random()
bob = algorand.account.random()

dispenser = algorand.account.localnet_dispenser()
algorand.account.ensure_funded(alice.addr, dispenser.addr, AlgoAmount(algo=10))
algorand.account.ensure_funded(bob.addr, dispenser.addr, AlgoAmount(algo=10))

result = (
    algorand.new_group()
    .add_payment(
        PaymentParams(sender=alice.addr, receiver=bob.addr, amount=AlgoAmount(algo=1))
    )
    .add_payment(
        PaymentParams(sender=bob.addr, receiver=alice.addr, amount=AlgoAmount(algo=2))
    )
    .send()
)
```

**What just happened:** Each `PaymentParams` specifies a different `sender`. The `TransactionComposer` resolves each sender's signer via the `AccountManager` — accounts created with `account.random()` are auto-registered, so no manual signer setup is needed.

### Atomic swap

Exchange assets between two parties — both transfers succeed or both fail.

```python
from algokit_utils import PaymentParams, AssetTransferParams
from algokit_utils.models.amount import AlgoAmount

# Atomic swap: Alice sends 100 Gold to Bob, Bob sends 5 ALGO to Alice
result = (
    algorand.new_group()
    .add_asset_transfer(
        AssetTransferParams(sender=alice.addr, receiver=bob.addr, asset_id=gold_id, amount=100)
    )
    .add_payment(
        PaymentParams(sender=bob.addr, receiver=alice.addr, amount=AlgoAmount(algo=5))
    )
    .send()
)
```

**What just happened:** The asset transfer and payment are grouped into a single atomic transaction. The Algorand protocol guarantees that either both execute or neither does — if Bob doesn't have enough ALGO, Alice's asset transfer is also rejected, eliminating counterparty risk.

### Build and send an atomic group

Build the group to inspect transactions before sending.

```python
from algokit_utils import PaymentParams
from algokit_utils.models.amount import AlgoAmount

composer = (
    algorand.new_group()
    .add_payment(
        PaymentParams(sender=sender.addr, receiver=receiver.addr, amount=AlgoAmount(algo=1))
    )
    .add_payment(
        PaymentParams(sender=sender.addr, receiver=receiver.addr, amount=AlgoAmount(algo=2))
    )
)

built = composer.build()
print(f"Group contains {len(built.transactions)} transactions")

result = composer.send()
print(f"Confirmed in round: {result.confirmations[0].confirmed_round}")
```

**What just happened:** Calling `.build()` composes and returns the transaction group with signers attached, letting you inspect the transactions before committing. A subsequent `.send()` signs and submits the already-built group.

### Simulate a transaction group before sending

Dry-run a group to check for errors without spending Algo.

```python
from algokit_utils import PaymentParams
from algokit_utils.models.amount import AlgoAmount

composer = algorand.new_group().add_payment(
    PaymentParams(sender=sender.addr, receiver=receiver.addr, amount=AlgoAmount(algo=5))
)

sim_result = composer.simulate(skip_signatures=True)

assert sim_result.simulate_response is not None
print(f"Would succeed: {len(sim_result.confirmations) > 0}")
print(f"Simulated round: {sim_result.simulate_response.last_round}")
```

**What just happened:** `.simulate(skip_signatures=True)` sends the group to the node's simulate endpoint, which evaluates it without real signatures or on-chain effects. The result includes a `simulate_response` with detailed execution info. This is useful for validating logic, checking opcode budgets, and estimating fees before sending real transactions.

### Set fees on grouped transactions

Control fees at the per-transaction level within a group.

```python
from algokit_utils import PaymentParams
from algokit_utils.models.amount import AlgoAmount

result = (
    algorand.new_group()
    .add_payment(
        PaymentParams(
            sender=sender.addr,
            receiver=receiver.addr,
            amount=AlgoAmount(algo=1),
            extra_fee=AlgoAmount(micro_algo=1000),  # covers an inner transaction
        )
    )
    .add_payment(
        PaymentParams(
            sender=sender.addr,
            receiver=receiver.addr,
            amount=AlgoAmount(algo=2),
            max_fee=AlgoAmount(micro_algo=3000),  # cap to prevent overspending
        )
    )
    .send()
)
```

**What just happened:** Fee control is set per transaction, not per group. `extra_fee` adds to the network-suggested fee (useful when a transaction triggers inner transactions that need fee coverage), and `max_fee` throws an error if the calculated fee exceeds the cap — protecting you from overspending during congestion.

### Clone a composer for reuse

Duplicate a composer so you can send the same group template multiple times.

```python
from algokit_utils import PaymentParams
from algokit_utils.models.amount import AlgoAmount

template = algorand.new_group().add_payment(
    PaymentParams(sender=sender.addr, receiver=receiver.addr, amount=AlgoAmount(algo=1))
)

copy = template.clone()

result = copy.send()
print(f"Sent from clone: {result.tx_ids[0]}")
```

**What just happened:** `.clone()` creates a shallow copy of the composer, including all queued transactions. The original and the clone are fully independent — you can modify or send one without affecting the other. This is handy for reusable transaction templates.
