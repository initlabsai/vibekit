## Network and client management

> All snippets in this section assume an `AlgorandClient` named `algorand` —
> see [Client initialization](#client-initialization) for setup.

### Access algod, indexer, and kmd clients

Retrieve the underlying SDK clients for direct low-level API calls.

```typescript
const algodClient = algorand.client.algod;
const indexerClient = algorand.client.indexer;
const kmdClient = algorand.client.kmd;
```

**What just happened:** You accessed the raw `algosdk` client objects through the
`ClientManager`. These are the same clients the library uses internally — you can call
any algod, indexer, or KMD REST endpoint on them directly. `indexer` and `kmd` will
throw if the corresponding service wasn't configured; use `algorand.client.indexerIfPresent`
if you want `undefined` instead of an error.

### Check if connected to LocalNet

Detect whether the current network is a local development network.

```typescript
const isLocalNet = await algorand.client.isLocalNet();

if (isLocalNet) {
  console.log("Running on LocalNet — safe to use test-only features");
}
```

**What just happened:** The `ClientManager` fetched the network's genesis ID from algod
and checked whether it matches the known LocalNet pattern. Use this to guard
development-only code paths like auto-funding from the dispenser or time/block warping.
The companion methods `isTestNet()` and `isMainNet()` work the same way.

### Get the current round

Query the latest committed round number from the network.

```typescript
const lastRound = await algorand.network.getLastRound();
console.log(`Current round: ${lastRound}`); // e.g. "Current round: 42"
```

**What just happened:** The `NetworkManager` called the algod status endpoint and
returned the last committed round as a `bigint`. This is useful for calculating
validity windows, polling for confirmation, or displaying chain progress.

### Get the latest timestamp

Retrieve the Unix timestamp of the most recent block.

```typescript
const timestamp = await algorand.network.getLatestTimestamp();
console.log(
  `Latest block time: ${new Date(Number(timestamp) * 1000).toISOString()}`,
);
```

**What just happened:** The `NetworkManager` fetched the timestamp (in seconds since
Unix epoch) of the latest block as a `bigint`. This reflects consensus time, not wall
clock time — on LocalNet it only advances when new blocks are produced.

### Wait until a specific round

Pause execution until the network reaches a target round.

```typescript
const currentRound = await algorand.network.getLastRound();
const targetRound = currentRound + 5n;

await algorand.network.waitUntilRound(targetRound);
console.log(`Round ${targetRound} reached!`);
```

**What just happened:** The `NetworkManager` polled the algod status endpoint until the
last committed round was at least `targetRound`. This is useful when you need to wait
for a specific number of rounds to pass — for example, waiting for a transaction's
validity window to expire.

### LocalNet time warp

Advance the blockchain timestamp on LocalNet without waiting for real time to pass.

```typescript
const now = await algorand.network.getLatestTimestamp();
const oneHourLater = now + 3600n;

await algorand.network.localNet.timeWarp(oneHourLater);
console.log(`Timestamp advanced to ${oneHourLater}`);
```

**What just happened:** The `LocalNetManager` called the dev-mode timestamp offset
endpoint to jump the chain clock forward by one hour. This only works on LocalNet and
is invaluable for testing time-dependent logic like vesting schedules or lock-up periods
without waiting in real time.

### LocalNet block warp

Advance the blockchain by generating empty blocks on LocalNet.

```typescript
const currentRound = await algorand.network.getLastRound();
const targetRound = currentRound + 100n;

await algorand.network.localNet.blockWarp(targetRound);
console.log(`Advanced to round ${targetRound}`);
```

**What just happened:** The `LocalNetManager` generated empty blocks until the chain
reached `targetRound`. This is useful for testing round-dependent logic — for example,
verifying that a contract correctly rejects calls after a deadline round has passed.

### Set the default validity window

Control how many rounds a transaction remains valid before it expires.

```typescript
const algorand =
  AlgorandClient.defaultLocalNet().setDefaultValidityWindow(1000);
```

**What just happened:** All transactions created through this client will now have a
validity window of 1,000 rounds (the gap between first and last valid round). The
Algorand default is 1,000 rounds — increase it if your signing workflow is slow, or
decrease it for tighter replay protection.

### Cache suggested params

Avoid redundant algod calls by caching the transaction parameters.

```typescript
// Cache for 30 seconds using the timeout
const algorand =
  AlgorandClient.mainNet().setSuggestedParamsCacheTimeout(30_000);

// Or cache specific params until a fixed point in time
const params = await algorand.getSuggestedParams();
algorand.setSuggestedParamsCache(params, new Date(Date.now() + 60_000));
```

**What just happened:** By default, every transaction fetches fresh `SuggestedParams`
from algod (current round, genesis info, fee). Caching avoids that round-trip on every
send — `setSuggestedParamsCacheTimeout` sets how long cached params stay valid, while
`setSuggestedParamsCache` lets you inject specific params with an explicit expiry.
Cached params are automatically refreshed once the cache expires.
