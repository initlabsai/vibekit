# Compose Mode & Single-Network Test Prompt

Tests the **other half of the write contract**: compose-mode deployments
return unsigned transaction groups instead of executing, and single-network
deployments inject no `network` parameter at all. Follow
[README.md](README.md) conventions. **Nothing in this file may move funds or
mutate chain state** — verify balances unchanged at the end.

**Prereq:** localnet running; ACCT_A funded (addresses from
[keystore.md](keystore.md) work — the keystore daemon itself is NOT needed
here). Requires reconnecting the MCP server twice with different env
(operator step, or edit `.mcp.json` between sections):

- Section A: `SIGNING=compose`, `NETWORK=localnet`, `NETWORKS=localnet,testnet,mainnet`
- Section B: `SIGNING=compose`, `NETWORK=localnet`, `NETWORKS=localnet` (single network)

## Section A — compose mode (multi-network)

1. Inspect the MCP tool list.
   - Verify: `create_signing_account` and `list_signing_addresses` are **absent** — keystore tools must not be mounted in a signer-less deployment.
2. `send_payment`: 100000 µALGO ACCT_A → ACCT_A, `network: "localnet"`.
   - Verify: returns `unsignedGroup` (array of 1 base64 string) and a human-readable `summary` — **no** `txids`, no `confirmedRound`.
   - Verify: the summary names the amount, sender, and receiver.
   - Verify via `lookup_account` that ACCT_A's balance is unchanged (nothing was submitted).
3. `send_group_transactions` with two payment TxnSpecs from ACCT_A, `network: "localnet"`.
   - Verify: `unsignedGroup` has 2 entries in spec order; the summary has one indexed line per transaction (`[0] …; [1] …`).
4. **Close-account warning in the summary**: `send_payment` from ACCT_A with `closeRemainderTo` set to another address AND `confirmCloseAccount: true`, `network: "localnet"`.
   - Verify: composes (no funds move — nothing is signed), and the summary contains the explicit `CLOSE ACCOUNT` warning naming the close-to address. This text is what a human external signer relies on.
5. **Gates still apply in compose**: repeat step 4 **without** `confirmCloseAccount`.
   - Verify: refused with `CLOSE_NOT_CONFIRMED` — composing an unsigned close is still a close.
6. **Network gate still applies in compose**: `send_payment` omitting `network`.
   - Verify: refused (schema-required param or `NETWORK_REQUIRED`).
7. `asset_create` from ACCT_A (any params), `network: "localnet"`.
   - Verify: composes to a 1-txn `unsignedGroup` with a create summary.
8. `app_deploy` from ACCT_A with the counter app spec from [contracts.md](contracts.md).
   - Verify: returns `unsignedGroup` + a summary like `create app "SmokeCounter" (bare)` — not an appId (nothing executed).
9. `simulate_transactions` with one payment TxnSpec from ACCT_A, `network: "localnet"`.
   - Verify: simulation works in compose mode (`wouldSucceed: true`) — simulation needs no signer.
10. Reads (`lookup_account`, `get_network`) behave identically to execute mode.

## Section B — single-network deployment (`NETWORKS=localnet`)

11. Inspect the MCP tool list.
    - Verify: **no tool has a `network` parameter** — with one served network the param is never injected, on reads or writes.
12. `send_payment`: 100000 µALGO ACCT_A → ACCT_A with **no** `network` argument.
    - Verify: composes successfully — single-network writes need no explicit network (there is nothing to disambiguate).
13. `send_payment` **with** `network: "localnet"` anyway.
    - Verify: rejected as an unknown argument, or cleanly ignored — report which (the parameter is reserved and not declared in this deployment).

## Optional (operator-observed) — daemon-down fallback

14. With `SIGNING=execute` configured but the keystore daemon **stopped**, restart the MCP server.
    - Verify (operator, via server stderr): a loud warning that it fell back to compose mode; write tools then return unsigned groups. SKIP if stderr is not observable in your harness.

## Final invariant

15. `lookup_account` for ACCT_A: balance identical to the start of this file.
