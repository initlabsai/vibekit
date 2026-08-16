## Test Results

**1. `lookup_account` ACCT_A** — PASS
`balanceAlgos: 9.534` (plausible ALGO, not µALGO); `status: "Offline"`, totals (`totalAssetsOptedIn`, `totalAppsOptedIn`, etc.) present.

**2. `batch_lookup_accounts` [ACCT_A, ACCT_B]** — PASS
Both returned in an `accounts` array, unambiguously keyed by `address` field (9.534 / 10.447 ALGO respectively).

**3. `search_accounts` (`currencyGreaterThan: 0, limit: 10`)** — PASS
Returned exactly 10 well-formed accounts (full page) including ACCT_A and ACCT_B; `nextToken` present, consistent with a full page (not a short one).

**4. `search_account_transactions` ACCT_A, `limit: 20`** — PASS
Returned pay, axfer, acfg, afrz, and appl (id 1022) transactions matching prior transactions/assets/contracts activity. Fees shown in ALGO (`0.001`), payment amounts in ALGO (`0.1`, `0.25`, `10`). `globalStateDelta` uint values are plain numbers (1, 2), not mangled. No `OUTPUT_MISMATCH` occurred.

**5. `search_account_transactions` ACCT_A, `txType: "axfer"`** — PASS
All 3 returned transactions are `type: "axfer"`.

**6. `get_account_assets` ACCT_A** — PASS
Empty `assets: []` — consistent with the axfer history (sent/received 500 units, net closed out); no remaining holdings, which is a valid state.

**7. `get_account_app_local_states` ACCT_A** — PASS
Empty `appLocalStates: []` — consistent with the counter app (1022) having been closed out/deleted per contracts.md; explicitly allowed as PASS by spec.

**8. `get_account_portfolio` ACCT_A** — PASS
`algoBalance: 9.534`, `assets: [], totalAssets: 0` — coherent with steps 1 and 6.

**9. `lookup_account` address `"nonsense"`** — PASS
Returned `INVALID_ADDRESS: Invalid Algorand address: nonsense` — clean refusal, not an indexer passthrough.

**10. `lookup_account` ZeroAddress (never used)** — WARN
Raw error: `Network request error. Received status 404 (Not Found): no accounts found for address: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ`. This is a not-found result, but unlike test 9's clean `INVALID_ADDRESS` refusal, it's a raw indexer 4xx passthrough (exposes "Network request error", HTTP status text) rather than a normalized "clean not-found" response. Reporting as WARN since it functions correctly but the error shape is inconsistent with the tool's own error-handling style elsewhere.

## Summary

| Total | Passed | Failed | Warned | Skipped |
|-------|--------|--------|--------|---------|
| 10    | 9      | 0      | 1      | 0       |
