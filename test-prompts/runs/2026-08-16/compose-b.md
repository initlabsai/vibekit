Balance unchanged (9.529 ALGOs), confirming nothing was submitted.

## Test Results — Section B (steps 11–13)

**11. PASS** — No tool has a `network` parameter in this single-network deployment. Verified across `send_payment`, `lookup_account`, `get_network`, `app_deploy`, `create_asset`, `send_group_transactions` — none declare `network`. `get_network` confirms `servedNetworks: ["localnet"]`, `mode: "compose"`. (Keystore tools `create_signing_account`/`list_signing_addresses` also absent, consistent with signer-less deployment.)

**12. PASS** — `send_payment` (sender=receiver=ACCT_A, amountMicroAlgos=100000, no `network` arg) composed successfully, returning `unsignedGroup` (1 entry) + summary `[0] pay 100000 microALGO ACCT_A → ACCT_A`. No txids/confirmedRound.

**13. PASS** — Repeating the identical call with `network: "localnet"` added anyway succeeded and returned the same `unsignedGroup`/summary — the extra parameter was **cleanly ignored** (not rejected as an error).

**Final invariant — PASS** — `lookup_account` for ACCT_A: balance 9.529 ALGO, identical to the pre-test baseline. No funds moved.

## Summary

| Total | Passed | Failed | Skipped |
|---|---|---|---|
| 4 | 4 | 0 | 0 |

(Steps 1–10 [Section A], 14, and 15 were explicitly out of scope for this run.)
