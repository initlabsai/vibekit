## Asset operations

### Create a new asset

Mint a new Algorand Standard Asset (ASA) with full configuration.

```python
from algokit_utils import AlgorandClient, AlgoAmount, AssetCreateParams

algorand = AlgorandClient.default_localnet()
creator = algorand.account.random()
algorand.account.ensure_funded(creator, algorand.account.localnet_dispenser(), AlgoAmount(algo=10))

result = algorand.send.asset_create(
    AssetCreateParams(
        sender=creator.addr,
        total=1_000_000,
        decimals=6,
        asset_name="AlgoKit Gold",
        unit_name="AGOLD",
        url="https://example.com/agold",
        manager=creator.addr,
        reserve=creator.addr,
        freeze=creator.addr,
        clawback=creator.addr,
        default_frozen=False,
    )
)

asset_id = result.asset_id
print(f"Created asset {asset_id}")
```

**What just happened:** `algorand.send.asset_create()` built, signed, and submitted an asset-creation transaction. The returned `result` includes the new `asset_id` alongside the usual transaction confirmation. The four role addresses (`manager`, `reserve`, `freeze`, `clawback`) control post-creation management — omit any of them to permanently lock that capability.

### Opt in to an asset

An account must opt in before it can receive a non-Algo asset.

```python
from algokit_utils import AssetOptInParams

receiver = algorand.account.random()
algorand.account.ensure_funded(receiver, algorand.account.localnet_dispenser(), AlgoAmount(algo=10))

algorand.send.asset_opt_in(
    AssetOptInParams(
        sender=receiver.addr,
        asset_id=asset_id,
    )
)
```

**What just happened:** `asset_opt_in` sends a zero-amount asset transfer from the account to itself, which is how Algorand records "this account is willing to hold this asset". Until an account opts in, any transfer to it will fail.

### Transfer an asset

Move ASA units between two opted-in accounts.

```python
from algokit_utils import AssetTransferParams

algorand.send.asset_transfer(
    AssetTransferParams(
        sender=creator.addr,
        receiver=receiver.addr,
        asset_id=asset_id,
        amount=100,
    )
)
```

**What just happened:** 100 base units of the asset were transferred from `creator` to `receiver`. Because the asset has 6 decimals, this represents 0.000100 of the display unit.

### Opt out of an asset

Close out an asset holding by returning remaining units to the asset creator.

```python
from algokit_utils import AssetOptOutParams

algorand.send.asset_opt_out(
    AssetOptOutParams(
        sender=receiver.addr,
        asset_id=asset_id,
        creator=creator.addr,
    ),
    ensure_zero_balance=True,
)
```

**What just happened:** `asset_opt_out` removes the asset holding from the account and sends any remaining balance to the `creator` address. The `ensure_zero_balance` parameter (default `True`) is passed as a separate keyword argument — not inside `AssetOptOutParams` — and makes the call raise `ValueError` if the account still holds a non-zero balance, protecting against accidental asset loss.

### Freeze and unfreeze an asset

The freeze-role account can toggle an account's ability to transact a specific asset.

```python
from algokit_utils import AssetFreezeParams

# Freeze the receiver's holding
algorand.send.asset_freeze(
    AssetFreezeParams(
        sender=creator.addr,
        asset_id=asset_id,
        account=receiver.addr,
        frozen=True,
    )
)

# Unfreeze it later
algorand.send.asset_freeze(
    AssetFreezeParams(
        sender=creator.addr,
        asset_id=asset_id,
        account=receiver.addr,
        frozen=False,
    )
)
```

**What just happened:** The `freeze`-role account toggled the `frozen` flag on `receiver`'s holding. While frozen, the target account cannot send or receive that asset. Only the address assigned as the `freeze` role during asset creation (or reconfiguration) can issue this transaction.

### Configure (reconfigure) an asset

Update the management addresses of an existing asset.

```python
from algokit_utils import AssetConfigParams

new_manager = algorand.account.random()

algorand.send.asset_config(
    AssetConfigParams(
        sender=creator.addr,
        asset_id=asset_id,
        manager=new_manager.addr,
        reserve=creator.addr,
        freeze=creator.addr,
        clawback=creator.addr,
    )
)
```

**What just happened:** `asset_config` updated the asset's manager address to a new account. All four role addresses must be supplied in a config transaction — any address you omit will be permanently cleared, irrevocably removing that capability. Only the current `manager` can submit this transaction.

### Destroy an asset

Permanently delete an asset once all units have been returned to the creator.

```python
from algokit_utils import AssetDestroyParams

algorand.send.asset_destroy(
    AssetDestroyParams(
        sender=creator.addr,
        asset_id=asset_id,
    )
)
```

**What just happened:** `asset_destroy` removed the asset from the ledger entirely. This is only possible when the creator holds all issued units (i.e. the full `total` supply). Only the `manager`-role account can destroy the asset.

### Bulk opt in to multiple assets

Opt a single account in to several assets at once.

```python
results = algorand.asset.bulk_opt_in(
    account=account.addr,
    asset_ids=[asset_id_a, asset_id_b, asset_id_c],
)

for r in results:
    print(f"Opted in to asset {r.asset_id} — tx: {r.transaction_id}")
```

**What just happened:** `algorand.asset.bulk_opt_in()` batches opt-in transactions into atomic groups of up to 16 and sends them sequentially. Each entry in the returned list contains the `asset_id` and `transaction_id` for the opt-in.

### Bulk opt out of multiple assets

Remove multiple asset holdings in a single call.

```python
results = algorand.asset.bulk_opt_out(
    account=account.addr,
    asset_ids=[asset_id_a, asset_id_b, asset_id_c],
)

for r in results:
    print(f"Opted out of asset {r.asset_id} — tx: {r.transaction_id}")
```

**What just happened:** `bulk_opt_out` works like `bulk_opt_in` but in reverse — it closes each asset holding and sends remaining balances to the respective asset creators. By default it checks for zero balances before opting out; pass `ensure_zero_balance=False` to skip this check (any remaining units will be forfeited to the creator).

### Get asset information

Look up the current on-chain parameters for an asset.

```python
info = algorand.asset.get_by_id(asset_id)

print(f"Asset name: {info.asset_name}")
print(f"Total supply: {info.total}")
print(f"Decimals: {info.decimals}")
print(f"Creator: {info.creator}")
print(f"Manager: {info.manager}")
```

**What just happened:** `algorand.asset.get_by_id()` fetched the asset's current parameters from algod — including supply, decimals, name, URL, and all four role addresses. This is useful for verifying asset configuration or displaying metadata.
