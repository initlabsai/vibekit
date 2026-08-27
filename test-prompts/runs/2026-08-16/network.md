## Test Results

**1. `get_network` (no args)** — PASS
Reports `network: "localnet"`, `defaultNetwork: "localnet"`, `servedNetworks: ["localnet","testnet","mainnet"]`, `algodUrl`/`indexerUrl` = `http://localhost`.

**2. `get_network` (`network: "testnet"`)** — PASS
Reports `network: "testnet"`, `algodUrl: "https://testnet-api.4160.nodely.dev"`, `indexerUrl: "https://testnet-idx.4160.nodely.dev"` — public testnet identity, no localnet call implied.

**3. `get_network_status`** — PASS
`latestRound: 6` (≥0). `participation: 100` — finite (online stake is non-zero on this localnet, so 100 is expected, not NaN). Supply (`totalSupply: 9999999999.994`), block-time (`avgBlockTime`, `minBlockTime`, `maxBlockTime`), and TPS (`avgTps: 0`, `peakTps: 0`) fields all present and numeric.

**4. `lookup_block` (round 6, the reported latest)** — PASS
Returns round 6 with `timestamp: 1786839252`. `seed` and `previousBlockHash` are base64 strings (`"Q6iPoglcujqqp1TZVtnfQWuRWjXXPaBZc3FB7Jl5jJs="`), not arrays/objects.

**5. `lookup_block` (round 0)** — PASS
Succeeded (genesis block returned): `round: 0`, `timestamp: 0`, `transactionCount: 0`, valid base64 seed/hash fields.

**6. `search_block_headers` (`limit: 5`)** — WARN
Returned exactly 5 block summaries (rounds 0–4) with numeric rounds/timestamps — structurally correct.
However, `transactionCount` is reported as `0` for rounds 1–4, which is demonstrably wrong: `get_network_status`'s `blockDetails` for the same rounds reports `txnCount: 1` each, and `lookup_block` round 6 independently confirms `transactionCount: 1`. This confirms the README's caveat that headers endpoints don't reliably carry transaction counts — flagging per the blanket WARN rule rather than failing, since round/timestamp fields themselves are correct.

**7. `lookup_block` (round 999999999)** — PASS
Clean tool error, not a crash, not OUTPUT_MISMATCH:
`Network request error. Received status 404 (Not Found): error while looking up block for round '999999999': block not found`

## Summary

| Total | Passed | Failed | Warned | Skipped |
|---|---|---|---|---|
| 7 | 6 | 0 | 1 | 0 |
