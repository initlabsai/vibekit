Test 17 PASS — clean `INVALID_ADDRESS` validation error, no signing attempted.

## Results

| # | Test | Result |
|---|------|--------|
| 1 | create_asset (ACCT_A) | PASS (asset id not in create result/lookup_transaction; recovered via search_assets → ASSET_ID 1013) |
| 2 | get_asset_info | PASS |
| 3 | lookup_asset | PASS |
| 4 | search_assets by name | PASS |
| 5 | asset_opt_in (ACCT_B) | PASS |
| 6 | asset_transfer 500 A→B | PASS |
| 7 | search_asset_balances | PASS |
| 8 | search_asset_transactions | PASS |
| 9 | asset_freeze (freeze B) | PASS |
| 10 | asset_transfer while frozen | PASS (clean on-chain rejection) |
| 11 | asset_freeze (unfreeze B) | PASS |
| 12 | asset_config (all 4 roles) | PASS |
| 13 | asset_opt_out with nonzero balance | PASS (NONZERO_BALANCE refusal) |
| 14 | transfer back + opt_out | PASS |
| 15 | asset_destroy | PASS |
| 16 | get_asset_info post-destroy | PASS (clean 404 "asset does not exist") |
| 17 | asset_transfer invalid sender | PASS (INVALID_ADDRESS, pre-signing) |

**Summary: 17 total / 17 passed / 0 failed / 0 skipped**

Two WARNs (no FAILs):
- **Step 1**: neither the `create_asset` result nor `lookup_transaction` on the create txid surfaced the created asset index — had to fall back to `search_assets` by name to recover ASSET_ID. Consider adding `createdAssetIndex` to one of those tool outputs.
- **Step 7**: `search_asset_balances.amount` returns a decimal-shifted, thousands-comma-formatted string (e.g. `"9,995"`, `"5"`) rather than raw base units, unlike `get_asset_info`/`lookup_asset` which report raw integer totals. This is an inconsistency worth documenting/normalizing across asset tools.
