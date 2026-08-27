# TestNet Dispenser Test Prompt

Tests `fund_testnet_account` against the Algorand Foundation TestNet
dispenser. **Costs a daily-limited faucet allowance** — run sparingly.
Follow [README.md](README.md) conventions.

**Prereq:** `vibekit dispenser login` completed (operator step); a signing
account address to fund (create one via `create_signing_account` if needed).

## Tests

1. `fund_testnet_account` for the target address with `network: "testnet"` and no explicit amount.
   - Verify: returns a `txId` (string) and `amountMicroAlgos` (number); receiver echoes the target.
2. `lookup_account` for the target with `network: "testnet"`.
   - Verify: balance reflects the dispensed amount (allow indexer lag; retry once after ~5s).
3. `fund_testnet_account` with `network: "localnet"`.
   - Verify: refused with `WRONG_NETWORK` — no request should reach the dispenser API.
4. (Only if the daily limit is already exhausted) repeat step 1.
   - Verify: clean `DISPENSER_LIMIT` error with a human-readable message — not a raw 429.
5. (Only if logged out) `fund_testnet_account` after `vibekit dispenser logout`-equivalent state.
   - Verify: `DISPENSER_TOKEN_EXPIRED` pointing at `vibekit dispenser login`.

Steps 4–5 are conditional; mark SKIPPED when their precondition doesn't hold —
do not engineer the precondition by burning the daily limit.
