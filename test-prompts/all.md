# Full Localnet Test Run

Sequences the localnet prompt files into one end-to-end run (~50 tools).
Read [README.md](README.md) first — its reporting conventions and blanket
assertions apply to the entire run. Mainnet plugin tests and the testnet
dispenser are separate ([plugins.md](plugins.md),
[testnet-dispenser.md](testnet-dispenser.md)).

## Setup

```bash
vibekit localnet start
vibekit keystore serve &
```

MCP server connected with `NETWORK=localnet`,
`NETWORKS=localnet,testnet,mainnet`, `SIGNING=execute`.

## Phases (run in order — later phases reuse earlier state)

1. **[network.md](network.md)** — no dependencies.
2. **[keystore.md](keystore.md)** — creates ACCT_A / ACCT_B; ACCT_A gets funded. Carry both addresses forward.
3. Fund ACCT_B as well: `vibekit localnet fund <ACCT_B>` (assets phase needs its min balance).
4. **[transactions.md](transactions.md)** — payments, groups, simulate, lookups.
5. **[assets.md](assets.md)** — full ASA lifecycle.
6. **[contracts.md](contracts.md)** — deploy/call/state/teardown of the counter app.
7. **[accounts.md](accounts.md)** — history-dependent lookups (needs 4–6 done).
8. **[gates.md](gates.md)** — refusal behaviors; must not move funds.

## Final report

- Per-phase PASS/FAIL/WARN/SKIP counts and a combined table.
- Every `OUTPUT_MISMATCH` occurrence verbatim (target: zero).
- Every WARN (unit ambiguity, inconsistent field names, misleading tool
  descriptions) — these feed the pre-1.0 contract polish.
- Total tool-call count and wall-clock time, for harness cost planning.
