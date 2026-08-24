# Applications and authorization

Use this guide for application entry points, privileged methods, role changes,
lifecycle handlers, pausing, upgrades, and deletion.

## Classify every callable path

For every ABI method and lifecycle action, decide whether it is:

- **permissionless**, with every argument and consumed transaction treated as
  hostile; or
- **permissioned**, with an explicit on-chain authorization policy.

Fund movement, configuration changes, treasury redirects, role management,
asset control, upgrade, and deletion normally require a defined authority.
Verify authorization at the state-changing entry point. A client check, hidden
button, deployment convention, or method name is not access control.

Trace delegated authority too. If an admin can appoint an operator, ask what
the operator can appoint or change and whether role revocation actually removes
all paths to the privilege.

## Review privilege storage and rotation

Check:

- how the initial authority is established at creation;
- whether the policy compares the complete account identity intended;
- whether role keys can collide or be confused across roles;
- who can grant, revoke, or recover each role;
- whether the last required authority can be accidentally removed;
- whether a one-step address change can permanently lock administration;
- whether creator privileges remain intentionally valid after admin rotation;
- whether role storage has a deliberate MBR funding and cleanup policy.

For mutable ownership, prefer a two-step handoff: the current authority
proposes an account, and that exact account accepts. Provide cancellation and
define recovery behavior. For a fixed, small role set, global state can be
clearer than a dynamic `BoxMap`; use boxes when membership genuinely scales.

A minimal permissioned pattern is:

```typescript
import type { bytes } from "@algorandfoundation/algorand-typescript";
import {
  Account,
  Contract,
  Global,
  GlobalState,
  Txn,
  assert,
} from "@algorandfoundation/algorand-typescript";

export class Treasury extends Contract {
  admin = GlobalState<bytes>({ key: "admin" });
  treasury = GlobalState<bytes>({ key: "treasury" });

  createApplication(): void {
    this.admin.value = Global.creatorAddress.bytes;
    this.treasury.value = Global.creatorAddress.bytes;
  }

  setTreasury(next: Account): void {
    assert(Txn.sender.bytes === this.admin.value, "Admin only");
    this.treasury.value = next.bytes;
  }
}
```

The check establishes only caller authority. Audit the new value and every
downstream use separately.

## Review lifecycle defaults and handlers

PuyaTs applications reject update and delete by default when the contract does
not define the corresponding handlers. Raw TEAL has different default risks,
so confirm the reviewed compiler and generated programs rather than importing
an assumption from another stack.

When handlers exist, verify:

- update and delete use the intended authorization policy;
- opt-in, close-out, and clear-state behavior is explicit;
- each handler is reachable only through its intended on-completion action;
- a public ABI route cannot invoke equivalent privileged behavior;
- tests cover unauthorized callers and unexpected lifecycle actions.

## Treat upgrades as total code replacement

An approved update replaces approval and clear-state programs. On current
protocols, the update transaction can also change extra program pages and the
global state schema; confirm these capabilities against the target network's
protocol version. The new program can remove the current authorization,
timelock, pause, and migration rules. Document that trust assumption.

For an upgrade policy, review:

1. who schedules, cancels, and executes an update;
2. whether the delay uses a monotonic on-chain value and cannot underflow;
3. whether the announcement binds both proposed program byte strings, or an
   unambiguous commitment to them;
4. whether execution compares the actual update transaction programs with the
   announced commitment;
5. whether replay or replacement of a scheduled upgrade is defined;
6. whether users have a practical exit window;
7. whether schema and extra-page changes match the proposed program and
   migration plan;
8. who becomes responsible for the changed schema and page MBR, and whether
   that sponsor can safely retain the required balance;
9. how global, local, and box storage migrates.

Storing a program hash without comparing it to the programs carried by the
update transaction does not enforce the announcement. Likewise, clearing a
schedule inside the old program does not constrain what the installed program
does next.

Updates preserve storage. Inventory old keys, schemas, and boxes; ensure the
new code cannot reinterpret stale bytes under a new meaning. Check partial
migration, repeated migration, rollback, and interruption paths.

## Review deletion as an asset transition

Deletion must be authorized and reachable only after the application has
handled every asset and storage obligation. Check:

- all spendable ALGO is sent according to policy;
- all ASA holdings are transferred or closed intentionally;
- created assets are handled according to their control model;
- every box is deleted so its MBR is released;
- liabilities, queued withdrawals, and claims are zero or migrated;
- cleanup cannot be front-run into an inconsistent state;
- the final balance equals the dynamic minimum balance expected for deletion.

A balance check alone may miss ASAs, boxes, and application-level liabilities.
Trace each inventory explicitly.

## Review pause and emergency authority

A pause mechanism reduces incident blast radius only when:

- pause and unpause have the intended, preferably distinct, authority model;
- every critical value-moving path checks the pause state;
- safe withdrawals or recovery paths remain available when appropriate;
- pausing cannot permanently trap users without an escalation or timeout;
- monitoring and operators can invoke it within the assumed response time.

Treat a powerful emergency key as a trust assumption. A pause flag with one
unguarded withdrawal, inner-call, lifecycle, or alternate ABI route is
incomplete.

## Common findings to prove or reject

- privileged ABI method is callable by any account;
- update or deletion handler lacks authorization;
- role rotation can lock the protocol or retain an unintended old admin;
- timelock does not bind the actual replacement programs;
- upgrade reinterprets or strands existing storage;
- deletion can strand ALGO, ASAs, boxes, or user liabilities;
- pause protection is missing from an equivalent value-moving path.

For each candidate, establish the reachable path and impact before assigning a
severity.
