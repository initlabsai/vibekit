# Transactions Tools Test Prompt

Test payments, groups, simulation, and transaction lookups on localnet.
Follow [README.md](README.md) conventions.

**Tools:** `send_payment`, `send_group_transactions`, `simulate_transactions`,
`lookup_transaction`, `search_transactions`, `lookup_transaction_group`

**Prereq:** two signing accounts, ACCT_A funded (from [keystore.md](keystore.md),
or create+fund fresh ones the same way).

## Tests

### Simple payment

1. `send_payment`: 250000 µALGO from ACCT_A to ACCT_B with `note: "vibekit smoke"`, `network: "localnet"`.
   - Verify: returns `txids` (1 entry) and a numeric `confirmedRound`.
2. `lookup_transaction` with that txid.
   - Verify: `type` is `pay`, sender/receiver match.
   - Verify: `paymentAmount` is **0.25** (ALGO, not µALGO) and `fee` is in ALGO (~0.001).
   - Verify: `note` decodes to the string `vibekit smoke` (printable text must arrive as text, not base64).

### Grouped transactions

3. `send_group_transactions` with two payment TxnSpecs from ACCT_A (e.g. `amountMicroAlgos: 100000` to ACCT_B and 100000 back to ACCT_A itself), `network: "localnet"`.
   - Verify: executes with 2 txids, one confirmedRound.
4. `lookup_transaction` on the first txid; note its `group` field (base64).
5. `lookup_transaction_group` with that group ID.
   - Verify: returns both transactions of the group.

### Simulation (no spend)

6. `simulate_transactions` with a single payment TxnSpec from ACCT_A to ACCT_B of 1000 µALGO (`network: "localnet"`).
   - Verify: `wouldSucceed: true`, one entry in `transactionResults`, `simulatedRound` numeric.
   - Verify: ACCT_A's balance did NOT change (check via `lookup_account`).
7. `simulate_transactions` with a payment whose amount exceeds ACCT_A's balance.
   - Verify: `wouldSucceed: false` with a `failureMessage` (a clean simulation result, not a thrown error).

### Search

8. `search_transactions` with `txType: "pay"`, `limit: 5`.
   - Verify: ≤ 5 results, all type `pay`; if a `nextToken` is returned on a full page, calling again with it returns different transactions.

### Non-ASCII note hygiene

9. `send_payment` 1000 µALGO ACCT_A→ACCT_B with a note containing control-ish text is not directly possible (notes are strings) — instead `lookup_transaction` on any earlier txid and verify no field contains raw bytes/arrays where a string is expected.

### Error paths

10. `lookup_transaction` with txid `"BOGUSBOGUSBOGUSBOGUSBOGUSBOGUSBOGUSBOGUSBOGUSBOGUS12"`.
    - Verify: clean tool error (not a crash, not OUTPUT_MISMATCH).
