# Assets Tools Test Prompt

Test the full ASA lifecycle on localnet. Follow [README.md](README.md)
conventions. Every write call: explicit `network: "localnet"`.

**Tools:** `asset_create`, `get_asset_info`, `lookup_asset`, `search_assets`,
`search_asset_balances`, `search_asset_transactions`, `asset_opt_in`,
`asset_transfer`, `asset_freeze`, `asset_config`, `asset_opt_out`, `asset_destroy`

**Prereq:** ACCT_A and ACCT_B both funded (asset opt-ins raise min balance —
fund ACCT_B too: `vibekit localnet fund <ACCT_B>`).

## Tests

### Create

1. `asset_create` from ACCT_A: `total: 1000000`, `decimals: 2`, `assetName: "Smoke Token"`, `unitName: "SMK"`, `manager`, `freeze` and `clawback` set to ACCT_A.
   - Verify: executes; extract the created ASSET_ID from the result/txid (via `lookup_transaction` on the create txid if the result doesn't carry it).
2. `get_asset_info` for ASSET_ID.
   - Verify: name/unit/decimals/total match; `manager`/`freeze`/`clawback` = ACCT_A; `creator` = ACCT_A.
3. `lookup_asset` for ASSET_ID (indexer view).
   - Verify: consistent with step 2. WARN on any field-name or unit inconsistency between the two tools' outputs (e.g. `total` vs `totalSupply`).

### Search

4. `search_assets` with `name: "Smoke Token"` (filters are exact-match).
   - Verify: ASSET_ID appears.

### Opt-in and transfer

5. `asset_opt_in`: ACCT_B opts into ASSET_ID.
6. `asset_transfer`: 500 base units of ASSET_ID from ACCT_A to ACCT_B.
   - Verify: executes.
7. `search_asset_balances` for ASSET_ID.
   - Verify: ACCT_A and ACCT_B both listed; ACCT_B's amount corresponds to 500 base units (report exactly how the amount is formatted — raw base units vs decimal-shifted string — as a WARN if ambiguous).
8. `search_asset_transactions` for ASSET_ID, `limit: 10`.
   - Verify: the transfer appears with `assetAmount` 500 and correct sender/receiver.

### Freeze

9. `asset_freeze`: ACCT_A freezes ASSET_ID for `freezeTarget: ACCT_B`, `frozen: true`.
10. `asset_transfer`: attempt 10 units ACCT_B → ACCT_A.
    - Verify: FAILS on-chain (frozen). A clean error is the PASS condition.
11. `asset_freeze` with `frozen: false` to unfreeze ACCT_B.

### Reconfigure (safe path — no role clearing)

12. `asset_config` from ACCT_A on ASSET_ID passing **all four** role addresses again (manager/reserve/freeze/clawback = ACCT_A).
    - Verify: executes without needing `confirmClearRoles` (nothing is being cleared). The refusal path is covered in [gates.md](gates.md).

### Opt-out and destroy

13. `asset_opt_out`: ACCT_B opts out of ASSET_ID with `closeAssetTo: ACCT_A` — while ACCT_B still holds the 500 units.
    - Verify: refused with `NONZERO_BALANCE` (opting out would forfeit holdings; the default `ensureZeroBalance` guard must catch it).
14. `asset_transfer`: 500 units back from ACCT_B to ACCT_A, then repeat the `asset_opt_out`.
    - Verify: now executes.
15. `asset_destroy` from ACCT_A on ASSET_ID.
    - Verify: executes (all units back with creator).
16. `get_asset_info` for ASSET_ID.
    - Verify: clean not-found style error (or deleted marker via `lookup_asset`) — report which.

### Error path

17. `asset_transfer` with an invalid sender address `"nonsense"`.
    - Verify: fails with an address-validation error (e.g. `INVALID_ADDRESS`) **before** anything is signed.
