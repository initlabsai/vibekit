## Test Results

**1. send_payment omitting `network`** — PASS
Refused at the **schema/host layer**: `Input validation error: Invalid arguments for tool send_payment: network: Invalid option: expected one of "localnet"|"testnet"|"mainnet"`. Core `NETWORK_REQUIRED` never reached — the schema itself makes `network` required.

**2. send_payment `network: "betanet"`** — PASS
Same schema enum rejection: `Invalid option: expected one of "localnet"|"testnet"|"mainnet"`. Rejected before dispatch, so `UNKNOWN_NETWORK` was never reached either.

**3. lookup_account (read) omitting `network`** — PASS
Succeeded against the default (localnet); balance matched the explicit-localnet call (9.534 ALGO).

**4. send_payment closeRemainderTo, no confirmCloseAccount** — PASS
`CLOSE_NOT_CONFIRMED: Transaction 0: closeRemainderTo closes the position and sends the ENTIRE remaining balance — set confirmCloseAccount: true to proceed`. No state mutated.

**5. Same, with `confirmCloseAccount: false`** — PASS
Identical `CLOSE_NOT_CONFIRMED` refusal — explicit `false` is not treated as consent.

**6. Setup: throwaway asset + opt-in + transfer** — PASS (setup)
Note: had to create two throwaway assets. The first (`1028`) was created without a manager/reserve/freeze/clawback, making it immediately immutable and unsuitable for the step 8/9 role-clearing test, so I created a second asset (`1031`, manager/reserve/freeze/clawback all = ACCT_A) and repeated opt-in/transfer for it. Both assets exist; `1028` was only used for the close-asset test (step 7), `1031` for role-clearing (steps 8–9).

**7. asset_transfer closeAssetTo, no confirmCloseAccount** — PASS
`CLOSE_NOT_CONFIRMED: Transaction 0: closeAssetTo closes the position and sends the ENTIRE remaining balance — set confirmCloseAccount: true to proceed` (tested against asset 1028, ACCT_B → ACCT_A).

**8. asset_config, manager-only, no confirmClearRoles** — PASS
Refused before reaching the chain: `strictEmptyAddressChecking is enabled, but an address is empty. If this is intentional, set strictEmptyAddressChecking to false.` — matches expected algosdk strict-empty-address behavior rather than a stable code. No txid returned.

**9. Same call with `confirmClearRoles: true`** — PASS
Executed: txid `CGT32SXHCPV2ZXZU7HLUCPCUUOB2PYWMN6VGUD6YCXS3UK2XUOIA`, confirmed round 33. (Mutates the throwaway asset as expected/permitted.)

**10. ABI-embedded acfg guard via app_call** — SKIPPED
No suitable ARC-4 app accepting a transaction-typed argument was deployable within this run's scope (would require authoring/compiling a contract with a txn-typed acfg arg, out of scope for a gate-test pass). Guard not exercised for the embedded-args path.

**11. fund_testnet_account, network: localnet** — PASS
`WRONG_NETWORK: fund_testnet_account only funds testnet (got network: localnet) — pass {"network":"testnet"} or omit it on testnet-default deployments`.

**12. send_payment, sender: "not-an-address"** — PASS
`INVALID_ADDRESS: Transaction 0: sender must be a valid address (got: not-an-address)` — refused before signing.

**13. Tool-list annotations (readOnlyHint/destructiveHint)** — WARN
Could not inspect: my MCP access path (ToolSearch schema fetch) only exposes `name`/`description`/`parameters` — no annotation fields (`readOnlyHint`, `destructiveHint`) are surfaced through this interface, so this check is unverifiable from my vantage point. Not a tool failure — a limitation of the inspection method available to me.

**14. Final invariant — balances** — PASS
ACCT_A: 9.534 → 9.529 ALGO (−0.005 = 5 fee-paying txns: 2× create_asset, 2× asset_transfer, 1× asset_config — all deliberate setup/steps 8-9). ACCT_B: 10.447 → 10.445 ALGO (−0.002 = 2× asset_opt_in). No refused call moved any funds.

## Summary

| Total | Passed | Failed | Skipped | Warn |
|---|---|---|---|---|
| 14 | 12 | 0 | 1 | 1 |

No FAILs, no OUTPUT_MISMATCH. One SKIP (test 10, no deployable app in scope) and one WARN (test 13, annotation metadata not visible through my tool-inspection path — recommend re-running that specific check with a client that surfaces tool annotations, e.g. Claude Desktop's tool inspector or a raw MCP `tools/list` call).
