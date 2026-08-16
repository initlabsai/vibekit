## Client initialization

### Connect to LocalNet

Connect to a local Algorand development network running on default ports.

```python
from algokit_utils import AlgorandClient

algorand = AlgorandClient.default_localnet()
```

**What just happened:** You created an `AlgorandClient` pre-configured with the
default LocalNet endpoints — algod on port 4001, indexer on port 8980, and KMD
on port 4002. This is the fastest way to start building and testing locally.

### Connect to TestNet

Connect to the public Algorand TestNet via AlgoNode.

```python
from algokit_utils import AlgorandClient

algorand = AlgorandClient.testnet()
```

**What just happened:** You created an `AlgorandClient` pointing at AlgoNode's
free TestNet endpoints for algod and indexer. KMD is not available on public
networks, so wallet operations that require KMD won't work here.

### Connect to MainNet

Connect to the public Algorand MainNet via AlgoNode.

```python
from algokit_utils import AlgorandClient

algorand = AlgorandClient.mainnet()
```

**What just happened:** You created an `AlgorandClient` pointing at AlgoNode's
MainNet endpoints. This is the live network — transactions here use real Algo.

### Custom configuration

Provide explicit connection details for each service.

```python
from algokit_utils import AlgorandClient, AlgoClientNetworkConfig

algorand = AlgorandClient.from_config(
    algod_config=AlgoClientNetworkConfig(
        server="https://my-algod-node.example.com",
        token="your-algod-api-token",
        port=443,
    ),
    indexer_config=AlgoClientNetworkConfig(
        server="https://my-indexer.example.com",
        token="your-indexer-api-token",
        port=443,
    ),
    kmd_config=AlgoClientNetworkConfig(
        server="http://localhost",
        token="a" * 64,
        port=4002,
    ),
)
```

**What just happened:** You created an `AlgorandClient` with custom server URLs,
ports, and API tokens. Use this when you run your own nodes or connect through a
third-party provider. Both `indexer_config` and `kmd_config` are optional — only
`algod_config` is required.

### Create from existing clients

Wrap pre-created SDK clients into an `AlgorandClient`.

```python
from algokit_algod_client import AlgodClient
from algokit_algod_client.config import ClientConfig as AlgodConfig
from algokit_indexer_client import IndexerClient
from algokit_indexer_client.config import ClientConfig as IndexerConfig
from algokit_kmd_client import KmdClient
from algokit_kmd_client.config import ClientConfig as KmdConfig
from algokit_utils import AlgorandClient

# Create SDK clients directly
algod = AlgodClient(AlgodConfig(base_url="http://localhost:4001", token="a" * 64))
indexer = IndexerClient(IndexerConfig(base_url="http://localhost:8980", token="a" * 64))
kmd = KmdClient(KmdConfig(base_url="http://localhost:4002", token="a" * 64))

# Wrap them in an AlgorandClient
algorand = AlgorandClient.from_clients(algod=algod, indexer=indexer, kmd=kmd)
```

**What just happened:** `AlgorandClient.from_clients()` wraps pre-configured SDK
clients you've already instantiated. This is useful when you need full control
over client creation — for example, when using custom HTTP sessions or clients
provided by another library. Only `algod` is required; `indexer` and `kmd` are optional.

### Environment variable configuration

Let the runtime environment decide which network to connect to.

```python
from algokit_utils import AlgorandClient

algorand = AlgorandClient.from_environment()
```

**What just happened:** The client read connection details from environment
variables (`ALGOD_SERVER`, `ALGOD_PORT`, `ALGOD_TOKEN` for algod and the
equivalent `INDEXER_*` variables for indexer). If those variables aren't set it
falls back to the default LocalNet configuration. This is ideal for code that
needs to run against different networks without changing source.
