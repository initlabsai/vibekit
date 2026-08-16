## Client initialization

### Connect to LocalNet

Connect to a local Algorand development network running on default ports.

```typescript
const algorand = AlgorandClient.defaultLocalNet();
```

**What just happened:** You created an `AlgorandClient` pre-configured with the
default LocalNet endpoints — algod on port 4001, indexer on port 8980, and KMD
on port 4002. This is the fastest way to start building and testing locally.

### Connect to TestNet

Connect to the public Algorand TestNet via AlgoNode.

```typescript
const algorand = AlgorandClient.testNet();
```

**What just happened:** You created an `AlgorandClient` pointing at AlgoNode's
free TestNet endpoints for algod and indexer. KMD is not available on public
networks, so wallet operations that require KMD won't work here.

### Connect to MainNet

Connect to the public Algorand MainNet via AlgoNode.

```typescript
const algorand = AlgorandClient.mainNet();
```

**What just happened:** You created an `AlgorandClient` pointing at AlgoNode's
MainNet endpoints. This is the live network — transactions here use real Algo.

### Custom configuration

Provide explicit connection details for each service.

```typescript
const algorand = AlgorandClient.fromConfig({
  algodConfig: {
    server: "https://my-algod-node.example.com",
    port: 443,
    token: "my-algod-api-token",
  },
  indexerConfig: {
    server: "https://my-indexer.example.com",
    port: 443,
    token: "my-indexer-api-token",
  },
});
```

**What just happened:** You created an `AlgorandClient` with custom server URLs,
ports, and API tokens. Use this when you run your own nodes or connect through a
third-party provider. Both `indexerConfig` and `kmdConfig` are optional — only
`algodConfig` is required.

### Environment variable configuration

Let the runtime environment decide which network to connect to.

```typescript
const algorand = AlgorandClient.fromEnvironment();
```

**What just happened:** The client read connection details from environment
variables (`ALGOD_SERVER`, `ALGOD_PORT`, `ALGOD_TOKEN` for algod and the
equivalent `INDEXER_*` variables for indexer). If those variables aren't set it
falls back to the default LocalNet configuration. This is ideal for code that
needs to run against different networks without changing source.
