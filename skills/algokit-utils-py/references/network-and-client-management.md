## Network and client management

> All snippets in this section assume an `AlgorandClient` named `algorand` — see [Client initialization](#client-initialization) for setup.

### Access algod, indexer, and kmd clients

Retrieve the underlying SDK clients for direct low-level API calls.

```python
algod_client = algorand.client.algod
indexer_client = algorand.client.indexer
kmd_client = algorand.client.kmd
```

**What just happened:** You accessed the raw SDK client objects through the `ClientManager`. These are the same clients the library uses internally — you can call any algod, indexer, or KMD REST endpoint on them directly. `indexer` and `kmd` raise `ValueError` if the corresponding service wasn't configured; use `algorand.client.indexer_if_present` to get `None` instead of an error.

### Check if connected to LocalNet

Detect whether the current network is a local development network.

```python
is_localnet = algorand.client.is_localnet()

if is_localnet:
    print("Running on LocalNet — safe to use test-only features")
```

**What just happened:** The `ClientManager` fetched the network's genesis ID from algod and checked whether it matches the known LocalNet pattern. Use this to guard development-only code paths like auto-funding from the dispenser. The companion methods `is_testnet()` and `is_mainnet()` work the same way, and `network()` returns a `NetworkDetail` dataclass with boolean flags and genesis info.

### Set the default validity window

Control how many rounds a transaction remains valid before it expires.

```python
algorand.set_default_validity_window(1000)
```

**What just happened:** All transactions created through this client will now have a validity window of 1,000 rounds (the gap between first and last valid round). Increase it if your signing workflow is slow, or decrease it for tighter replay protection. Returns `Self` for method chaining.

### Cache suggested params

Avoid redundant algod calls by caching the transaction parameters.

```python
import time

# Cache for 10 seconds using the timeout (in milliseconds)
algorand.set_suggested_params_cache_timeout(10_000)

# Or cache specific params until a fixed point in time
params = algorand.client.algod.suggested_params()
algorand.set_suggested_params_cache(params, until=time.time() + 3600)
```

**What just happened:** By default, every transaction fetches fresh `SuggestedParams` from algod (current round, genesis info, fee). Caching avoids that round-trip on every send — `set_suggested_params_cache_timeout` sets how long cached params stay valid (default 3,000 ms), while `set_suggested_params_cache` lets you inject specific params with an explicit expiry.
