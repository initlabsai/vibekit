## Test Results

1. **PASS** — `app_list_methods` returned contract name `SmokeCounter` and method `ping()void`.
2. **PASS** — `app_deploy` (bare create, ACCT_A) → appId `1022`, appAddress `PWUAR3EABHBFARQEBSBA6T72UUL4MKASRBFWCEZW54TPZJSZQ4AJJJLE4Y`, txid, confirmedRound 21.
3. **PASS** — `app_get_info(1022)` → creator = ACCT_A, globalInts = 1.
4. **PASS** — `lookup_application(1022)` → creator = ACCT_A, globalStateSchema.numUint = 1, consistent with step 3.
5. **PASS** — `search_applications(creator=ACCT_A)` → returned appId 1022.
6. **PASS** — `app_call` bare on 1022 from ACCT_A → executed, txid `5AT4CG5AEDFL4F5LZQOFK32666Y4VJSZF2PYHPDIHQNCMNLZ52OA`.
7. **PASS** — `read_global_state(1022)` → `count`, type `uint`, value `1`, `keyBase64: "Y291bnQ="` present.
8. **PASS** — `app_call` with `methodSignature: "ping()void"` on 1022 from ACCT_A → executed (ABI path).
9. **PASS** — `read_global_state(1022)` → `count` = `2`.
10. **PASS** — `lookup_transaction` on step-6 txid → `type: "appl"`, `applicationId: 1022`, no `innerTxns` field (correctly absent for an app with no inner txns). No OUTPUT_MISMATCH.
11. **PASS** — `app_opt_in(1022)` from ACCT_A (bare) → executed.
12. **PASS** — `read_local_state(1022, ACCT_A)` → `optedIn: true`, `state: []`.
13. **FAIL** — `read_local_state(1022, ACCT_B)` (never opted in) — expected clean `optedIn: false, state: []`; instead threw a raw error.
    - Tool: `mcp__vibekit__read_local_state`
    - Args: `{"appId":1022,"address":"L2MGM6VDPH7HME2IVMKLUYCLH5HWSZY7RQIMD5UCCTFNJ4M4DCBRXPSFJE","network":"localnet"}`
    - Raw error: `Network request error. Received status 404 (Not Found): account application info not found`
14. **PASS** — `read_box_state(1022, boxName="nope")` → `exists: false`, clean miss.
15. **PASS** — `lookup_application_logs(1022)` → `logData: []`.
16. **PASS** — `simulate_transactions` app_call on 1022 → `wouldSucceed: true`; `read_global_state` after simulation still shows `count: 2` (unchanged, not committed).
17. **PASS** — `app_close_out(1022)` from ACCT_A → executed; `read_local_state` now reports `optedIn: false`.
18. **PASS** — `app_delete(1022)` from ACCT_A → executed; both `app_get_info` and `lookup_application` for 1022 report 404 not-found (`application does not exist` / `no application found for application-id: 1022`).
19. **PASS** — `lookup_application(999999999)` → clean 404 error (`no application found for application-id: 999999999`), not a crash, not OUTPUT_MISMATCH.

## Summary

| Total | Passed | Failed | Skipped |
|-------|--------|--------|---------|
| 19    | 18     | 1      | 0       |

Only failure: test 13 — `read_local_state` doesn't gracefully handle an account that was never opted in (raw 404 propagated instead of the documented `optedIn: false` shape). Notably, the "closed-out" case (test 17) *does* return `optedIn: false` cleanly, so the gap is specifically the never-opted-in path.
