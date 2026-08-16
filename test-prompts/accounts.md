# Accounts Tools Test Prompt

Test account lookups on localnet. Follow [README.md](README.md) conventions.
Run this **after** [transactions.md](transactions.md), [assets.md](assets.md),
and [contracts.md](contracts.md) so ACCT_A has payment, asset, and app-call
history to look up.

**Tools:** `lookup_account`, `batch_lookup_accounts`, `search_accounts`,
`search_account_transactions`, `get_account_assets`,
`get_account_app_local_states`, `get_account_portfolio`

## Tests

### Lookups

1. `lookup_account` for ACCT_A.
   - Verify: `balanceAlgos` is a plausible ALGO number (not µALGO); status and totals fields present.
2. `batch_lookup_accounts` for [ACCT_A, ACCT_B].
   - Verify: both returned, order or keying is unambiguous.
3. `search_accounts` with a filter that matches ACCT_A (e.g. `currencyGreaterThan: 0`, `limit: 10`).
   - Verify: results are well-formed; pagination token behavior consistent (absent on a short page).

### Transaction history — inner-txn regression

4. `search_account_transactions` for ACCT_A, `limit: 20`.
   - Verify: the payments/asset transfers/app calls from earlier files appear.
   - Verify: fees/payment amounts are in ALGO.
   - **Any `OUTPUT_MISMATCH` is an automatic FAIL** — this call is the historical regression site for app calls with inner transactions.
5. `search_account_transactions` for ACCT_A with `txType: "axfer"`.
   - Verify: only asset transfers returned.

### Holdings and app state

6. `get_account_assets` for ACCT_A.
   - Verify: any remaining ASA holdings listed; amounts documented consistently (WARN if a raw-base-units string is indistinguishable from a decimal-shifted one).
7. `get_account_app_local_states` for ACCT_A.
   - Verify: succeeds; if the counter app from contracts.md was deleted/closed out this may be empty — that is PASS. Any `uint` values must be numbers or decimal strings, never mangled.
8. `get_account_portfolio` for ACCT_A.
   - Verify: a coherent combined view (balance + assets); consistent with steps 1 and 6.

### Error path

9. `lookup_account` with address `"nonsense"`.
   - Verify: `INVALID_ADDRESS` style refusal, not an indexer 4xx passthrough.
10. `lookup_account` for a valid-but-never-used address (e.g. the ZeroAddress `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ`).
    - Verify: clean zero-balance result or clean not-found — report which.
