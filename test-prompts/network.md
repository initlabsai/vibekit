# Network Tools Test Prompt

Test the VibeKit network tools on localnet via MCP. Follow the reporting
conventions and blanket assertions in [README.md](README.md).

**Tools:** `get_network`, `get_network_status`, `lookup_block`, `search_block_headers`

## Tests

### Deployment identity

1. Call `get_network` with no arguments.
   - Verify: reports `localnet` as the current/default network.
   - Verify: `servedNetworks` (or equivalent field) lists `localnet`, `testnet`, `mainnet`.
   - Verify: algod/indexer URLs point at localhost.
2. Call `get_network` with `network: "testnet"`.
   - Verify: reports testnet identity and public testnet URLs (no calls hit the network for this).

### Status

3. Call `get_network_status` (localnet).
   - Verify: `latestRound` is a number ≥ 0; `participation` is a finite number (never NaN — a fresh localnet with zero online stake must report 0).
   - Verify: supply, block-time, and TPS fields are present and numeric.

### Blocks

4. Call `lookup_block` for the round `get_network_status` reported as latest.
   - Verify: returns that round with a timestamp; byte-ish fields (seed, previous block hash) are base64 strings, not arrays or objects.
5. Call `lookup_block` for round 0.
   - Verify: succeeds (genesis) or fails with a clear not-found style error — either is PASS, but report which.
6. Call `search_block_headers` with `limit: 5`.
   - Verify: returns ≤ 5 block summaries with numeric rounds and timestamps.
   - WARN if any summary claims a `transactionCount` you can show is wrong (headers endpoints do not include transactions).

### Error path

7. Call `lookup_block` with a round far in the future (e.g. 999999999).
   - Verify: a clean tool error (not a crash, not OUTPUT_MISMATCH).
