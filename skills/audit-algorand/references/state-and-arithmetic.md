# State and arithmetic

Use this guide for global, local, and box state; clear state; minimum-balance
requirements; protocol phases; withdrawals; accounting; and numeric formulas.

## Choose storage by who can destroy it

A user can always clear their application local state. The clear-state program
runs, but the protocol deletes local state even when that program fails. Never
use local state as the sole record of debt, collateral, penalties, voting
eligibility, claims, or another obligation the user benefits from erasing.

Use box or global storage for protocol-critical records that must survive user
action. A representative contrast is:

```typescript
// Unsafe for persistent debt: the borrower can clear this local state.
debt = LocalState<uint64>({ key: "debt" });

// Persistent under application control; account for box MBR and references.
debt = BoxMap<Account, uint64>({ keyPrefix: "debt" });
```

For each state value, record:

- who can create, update, and delete it;
- which account can force lifecycle changes around it;
- its absence/default semantics;
- whether its key encoding can collide;
- which invariant depends on it;
- how it is migrated or retired.

## Audit clear-state behavior

Clear-state execution cannot use boxes. The caller also need not supply useful
foreign references, and a failing program still loses the user's local state.
Keep clear-state logic simple and best-effort.

Check:

- whether clearing local state erases a protocol obligation or entitlement;
- whether lost local values leave unaccounted funds in the application;
- whether global reconciliation is safe and bounded;
- whether any operation in the clear program can fail due to resources,
  arithmetic, or missing state;
- whether close-out and clear-state have intentionally different semantics.

Do not claim a clear program can prevent deletion of local state. Move durable
obligations elsewhere.

## Account for boxes and minimum balance

Boxes consume application-account minimum balance and require box I/O budget
and references. Trace who funds creation and who receives released MBR on
deletion. Check for attacker-controlled box growth, oversized values, key
collisions, unreachable cleanup, and storage that survives after its business
record is closed.

Use the live `minBalance` value rather than a hard-coded base balance when
calculating spendable ALGO:

```typescript
const app = Global.currentApplicationAddress;
assert(app.balance >= app.minBalance, "Invalid application balance");
assert(
  app.balance - app.minBalance >= amount,
  "Insufficient spendable balance",
);
```

The first comparison makes the subtraction invariant explicit. When refunding
released storage MBR, measure `minBalance` before and after deletion and refund
the actual delta. Verify the caller is entitled to that delta; otherwise an
attacker may delete records funded by someone else and collect the refund.

Before application deletion, all boxes must be deleted or their locked MBR is
unrecoverable. A count alone is sufficient only when every box-creation and
deletion path updates it atomically and cannot drift.

When the target protocol permits cross-application box access, inspect the
application parameters as part of the authority model. Foreign box reads can
expose records to any application, while family access can give applications
with the same creator write authority. Inventory every trusted family member,
review shared-box key namespaces, and test call trees involving untrusted
intermediate applications. Protocol call-stack restrictions are execution
constraints, not a substitute for application-level authorization and
accounting invariants.

## Model lifecycle with exclusive states

Independent booleans such as `saleOpen`, `paused`, `settling`, and `closed` can
form contradictory combinations. Prefer one authoritative phase value when
the protocol states are mutually exclusive.

For every state transition:

- prove the current phase and caller authority;
- enumerate allowed next phases;
- update state atomically with associated asset/accounting changes;
- reject skipped, repeated, and backward transitions unless intended;
- consider interruption, pause, upgrade, and timeout recovery;
- ensure every public method is allowed in exactly the intended phases.

Central helpers can make the transition relation visible, but inspect all
direct writes to the phase value for bypasses.

## Prefer pull-based settlement

For distributions, record each user's entitlement and let that user withdraw.
A single failed inner transaction in a push loop rolls back the whole call and
can block unrelated recipients.

Audit a pull withdrawal for checks-effects-interactions behavior in AVM terms:

- entitlement exists and belongs to the receiver;
- amount is captured before deletion or zeroing;
- the record is consumed exactly once;
- every alternate path consumes the same entitlement consistently;
- the inner transfer uses the intended receiver, asset, amount, and zero fee;
- failure rolls back both state and transfer;
- box deletion and MBR refund go to the intended party.

## Analyze numeric configuration before runtime

The AVM uses unsigned 64-bit arithmetic for `uint64`. Overflow, underflow, and
division by zero fail the transaction rather than silently wrapping. That
prevents corrupted arithmetic output, but unsafe parameters can still brick a
critical path or enable denial of service.

Trace formulas backward to every configuration setter. Reject parameter sets
that make any allowed runtime input invalid:

```typescript
const MAX_UINT64: uint64 = Uint64(18_446_744_073_709_551_615n)

configure(maxDeposits: uint64, rate: uint64, scale: uint64): void {
  assert(Txn.sender === Global.creatorAddress, 'Admin only')
  assert(scale > Uint64(0), 'Scale must be nonzero')
  if (rate > Uint64(0)) {
    assert(maxDeposits <= MAX_UINT64 / rate, 'Configuration can overflow')
  }
  // Store only after the full numeric envelope is proven.
}
```

Review:

- zero denominators and empty domains;
- multiplication before division and precision loss from operation order;
- addition/subtraction ordering and boundary checks;
- truncation, rounding direction, and accumulated dust;
- conversion from `biguint` or bytes back to `uint64`;
- exponent, shift, and loop bounds;
- time differences and timestamp/round assumptions;
- values that are safe individually but unsafe in combination.

Use `biguint` for intermediates that may exceed `uint64`, then prove the final
value fits before conversion. Big integers do not remove division, rounding,
resource, or economic-invariant risks.

## Reconcile accounting globally

For vaults, exchanges, lending, staking, and token contracts, write conservation
relationships such as:

- sum of user balances plus protocol reserves equals accounted holdings;
- minted supply minus burned supply equals circulating liabilities;
- collateral and price bounds cover borrowable value;
- queued plus paid withdrawals never exceed funded obligations;
- fees and rounding remainders have an explicit owner.

Trace deposit, transfer, claim, liquidation, settlement, migration, and deletion
against the same relationships. Test `0`, `1`, maximum supported values, values
just outside bounds, and long action sequences. A per-method assertion can pass
while the cross-method invariant drifts.
