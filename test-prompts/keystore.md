# Keystore Tools Test Prompt

Test signing-account lifecycle via the keystore daemon on localnet. Follow
[README.md](README.md) conventions. Requires `vibekit keystore serve` running.

**Tools:** `create_signing_account`, `list_signing_addresses`
**CLI (operator step, not a tool):** `vibekit localnet fund <ADDRESS>`

## Tests

### Creation

1. Call `create_signing_account` with `name: "SMOKE1"`.
   - Verify: returns a valid 58-char Algorand `address` and a `keyId`.
   - Verify: the echoed `name` is `SMOKE1`.
2. Call `create_signing_account` with no name.
   - Verify: returns address + keyId; no `name` field invented.

### Listing and label round-trip

3. Call `list_signing_addresses`.
   - Verify: both new addresses appear; the SMOKE1 entry carries `name: "SMOKE1"` (the label must survive the daemon round-trip, not just the creation echo).
   - Verify: `count` matches the array length.
   - Verify: **no private key material appears anywhere in any response.**

### Balances

4. Ask the operator to run `vibekit localnet fund <SMOKE1-address>` (or run it if you can execute shell commands), then call `list_signing_addresses` with `includeBalances: true`.
   - Verify: SMOKE1 shows a positive `balanceMicroAlgos` (integer µALGO); the unfunded account shows 0 or no balance — report which.

### Signing proof (end-to-end custody check)

5. Call `send_payment` with `sender: <SMOKE1>`, `receiver: <the other new address>`, `amountMicroAlgos: 100000`, `network: "localnet"`.
   - Verify: executes (returns `txids` + `confirmedRound`) — proving the daemon signed without exposing the key to this process.

Record both addresses in your report — later prompt files reuse them as
ACCT_A (funded) and ACCT_B.
