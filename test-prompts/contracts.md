# Contracts Tools Test Prompt

Test smart-contract deploy, calls, and state reads on localnet. Follow
[README.md](README.md) conventions. Every write call: explicit
`network: "localnet"`.

**Tools:** `app_deploy`, `app_list_methods`, `app_get_info`,
`lookup_application`, `search_applications`, `app_call`, `read_global_state`,
`app_opt_in`, `read_local_state`, `read_box_state`, `lookup_application_logs`,
`app_close_out`, `app_delete`, plus `lookup_transaction` (inner-txn check)
and `simulate_transactions`.

**Prereq:** ACCT_A funded.

## Fixture: counter app spec

An ARC-32 spec for a counter app. The approval program approves creation,
opt-in, close-out, and delete, and increments global `count` on every
non-creation NoOp call (bare or ABI). Schema: 1 global uint, 1 local uint.
Pass this JSON **as a string** for the `appSpec` parameter:

```json
{
  "name": "SmokeCounter",
  "contract": {
    "name": "SmokeCounter",
    "methods": [
      { "name": "ping", "args": [], "returns": { "type": "void" } }
    ]
  },
  "state": {
    "global": { "num_uints": 1, "num_byte_slices": 0 },
    "local": { "num_uints": 1, "num_byte_slices": 0 }
  },
  "source": {
    "approval": "I3ByYWdtYSB2ZXJzaW9uIDgKdHhuIEFwcGxpY2F0aW9uSUQKaW50IDAKPT0KYm56IGRvbmUKdHhuIE9uQ29tcGxldGlvbgppbnQgTm9PcAo9PQpieiBkb25lCmJ5dGUgImNvdW50IgpieXRlICJjb3VudCIKYXBwX2dsb2JhbF9nZXQKaW50IDEKKwphcHBfZ2xvYmFsX3B1dApkb25lOgppbnQgMQ==",
    "clear": "I3ByYWdtYSB2ZXJzaW9uIDgKaW50IDE="
  }
}
```

## Tests

### Spec introspection (no chain writes)

1. `app_list_methods` with the spec above.
   - Verify: returns contract name `SmokeCounter` and the `ping()void` method.

### Deploy

2. `app_deploy` from ACCT_A with the spec (bare create — no `method`).
   - Verify: returns numeric `appId`, a valid `appAddress`, `txid`, `confirmedRound`. Record APP_ID.
3. `app_get_info` for APP_ID.
   - Verify: creator = ACCT_A; global schema shows 1 uint.
4. `lookup_application` for APP_ID (indexer view).
   - Verify: consistent with step 3.
5. `search_applications` with `creator: ACCT_A`.
   - Verify: APP_ID appears.

### Calls and global state

6. `app_call` (bare — no methodSignature/appSpec) on APP_ID from ACCT_A.
   - Verify: executes.
7. `read_global_state` for APP_ID.
   - Verify: key `count` with `type: "uint"`, `value: 1`; entry includes `keyBase64`.
8. `app_call` with `methodSignature: "ping()void"` on APP_ID from ACCT_A.
   - Verify: executes (ABI call path).
9. `read_global_state` again.
   - Verify: `count` is now 2 (every NoOp increments).

### Inner-transaction lookup regression

10. `lookup_transaction` on the txid from step 6.
    - Verify: `type` is `appl`, `applicationId` = APP_ID. If the result carries `innerTxns` (this app makes none — an empty/absent field is correct), no entry may be malformed. **Any `OUTPUT_MISMATCH` here is an automatic FAIL.**

### Local state

11. `app_opt_in` on APP_ID from ACCT_A (bare).
    - Verify: executes.
12. `read_local_state` for APP_ID and ACCT_A.
    - Verify: `optedIn: true`; state list is empty (the app writes no local keys) — `optedIn` distinguishes this from "not opted in".
13. `read_local_state` for APP_ID and ACCT_B (not opted in).
    - Verify: `optedIn: false`, empty state — not an error.

### Boxes

14. `read_box_state` for APP_ID with `boxName: "nope"`.
    - Verify: `exists: false` (a clean miss, not an error). This app creates no boxes; box creation is out of scope here.

### Logs

15. `lookup_application_logs` for APP_ID.
    - Verify: succeeds; this app emits no logs, so an empty `logData` is correct. Entries, if any, must be `{txid, logs: [base64...]}` objects.

### Simulate an app call

16. `simulate_transactions` with one TxnSpec: `type: "app_call"`, `appId: APP_ID`, sender ACCT_A.
    - Verify: `wouldSucceed: true`; global `count` unchanged afterwards (simulation must not commit — check with `read_global_state`).

### Teardown

17. `app_close_out` on APP_ID from ACCT_A.
    - Verify: executes; `read_local_state` now reports `optedIn: false`.
18. `app_delete` on APP_ID from ACCT_A.
    - Verify: executes; `app_get_info` / `lookup_application` for APP_ID now reports not-found (e.g. `APP_NOT_FOUND`) or deleted — report which.

### Error path

19. `lookup_application` with `applicationId: 999999999`.
    - Verify: clean `APP_NOT_FOUND` style error — not a crash/NPE, not OUTPUT_MISMATCH.
