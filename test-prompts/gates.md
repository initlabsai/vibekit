# Write Gates & Refusals Test Prompt

Test that VibeKit's safety gates **refuse** correctly. Every test here expects
a refusal with a specific error code — a success is a FAIL, and so is a
generic error without the stated code. Nothing in this file should ever spend
funds or mutate chain state (verify balances are unchanged at the end).

Follow [README.md](README.md) conventions. **Prereq:** ACCT_A funded, ACCT_B
existing (from [keystore.md](keystore.md)).

## Tests

### Network gating (§10: never write to a defaulted chain)

1. Call `send_payment` (ACCT_A → ACCT_B, 1000 µALGO) **omitting** the `network` argument.
   - Verify: refused. Either the host rejects the arguments (the schema makes `network` required on write tools) or the core throws `NETWORK_REQUIRED`. Report which layer refused.
2. Call `send_payment` with `network: "betanet"` (not served).
   - Verify: refused — schema enum rejection or `UNKNOWN_NETWORK`.
3. Call a **read** tool (`lookup_account` for ACCT_A) omitting `network`.
   - Verify: succeeds against the default (localnet) — reads may default; writes may not.

### Close-account confirmation

4. `send_payment` from ACCT_A with `closeRemainderTo: ACCT_B` and **no** `confirmCloseAccount`, `network: "localnet"`.
   - Verify: refused with `CLOSE_NOT_CONFIRMED`. ACCT_A's balance unchanged.
5. Same call with `confirmCloseAccount: false`.
   - Verify: still refused with `CLOSE_NOT_CONFIRMED`.

### Close-asset confirmation

6. Create a throwaway asset from ACCT_A, opt ACCT_B in, transfer 10 units (all with `network: "localnet"`) — setup, not a gate test.
7. `asset_transfer` from ACCT_B with `closeAssetTo: ACCT_A` and no `confirmCloseAccount`.
   - Verify: refused with `CLOSE_NOT_CONFIRMED`.

### Permanent role-clearing confirmation

8. `asset_config` from ACCT_A on the throwaway asset passing **only** `manager: ACCT_A` (omitting reserve/freeze/clawback) and no `confirmClearRoles`.
   - Verify: refused — the guard is algosdk's strict empty-address checking, so expect an error about empty/blank role addresses rather than a stable code. The call must not reach the chain.
9. Same call with `confirmClearRoles: true`.
   - Verify: executes — the confirmation unlocks it. (This one mutates the throwaway asset; that's fine.)

### ABI-embedded acfg guard (bypass regression)

10. If an app accepting a transaction-typed argument is available, attempt an `app_call` whose `args` embeds an `asset_config` transaction object that omits role addresses, without `confirmClearRoles`.
    - Verify: refused — the guard must hold for acfg embedded in ABI args, not just top-level `asset_config`.
    - If no suitable app is deployable in this run, mark SKIPPED with reason.

### Dispenser network gate

11. Call `fund_testnet_account` for ACCT_A with `network: "localnet"` (if the dispenser tool is mounted; otherwise SKIP).
    - Verify: refused with `WRONG_NETWORK` — the dispenser only funds testnet.

### Address validation

12. `send_payment` with `sender: "not-an-address"`, `network: "localnet"`.
    - Verify: refused with `INVALID_ADDRESS` before any signing occurs.

### Annotations (host-level, if your MCP client can list tools)

13. Inspect the MCP tool list.
    - Verify: write tools (`send_payment`, `asset_*` writes, `app_deploy`, …) carry `readOnlyHint: false` / `destructiveHint: true`; pure reads carry `readOnlyHint: true`.
    - Verify: `create_signing_account` and `fund_testnet_account` are annotated as non-read-only (they mutate state) even though they spend no user funds.

### Final invariant

14. `lookup_account` for ACCT_A and ACCT_B.
    - Verify: balances match the start of this file minus only the deliberate setup in steps 6–9. No refused call moved funds.
