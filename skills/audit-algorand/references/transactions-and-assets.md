# Transactions and assets

Use this guide for transaction arguments, atomic groups, fee pooling, inner
transactions, application calls, payments, asset transfers, and ASA creation
or reconfiguration.

## Validate transaction meaning, not its position

For every transaction the application consumes, determine which fields define
the intended economic action. Depending on type, review:

- transaction type and sender policy;
- receiver and exact or bounded amount;
- asset or application ID;
- close, rekey, clawback, freeze, and configuration fields;
- fee and validity assumptions;
- lease or other replay identifier;
- accounts, applications, assets, boxes, or access-list resources consumed by
  the program;
- group relationship to the current application call.

Checking a group index, type, receiver, or amount alone rarely proves the whole
meaning. An attacker can construct transactions directly and substitute every
unchecked field.

Prefer a typed ARC-4 transaction parameter over a fixed absolute group index.
The router binds the referenced transaction to that ABI argument, while the
contract still validates its business fields:

```typescript
import {
  Contract,
  Global,
  GlobalState,
  Uint64,
  assert,
  gtxn,
  type uint64,
} from "@algorandfoundation/algorand-typescript";

export class CreditSale extends Contract {
  credits = GlobalState<uint64>({ key: "credits" });

  buyCredit(payment: gtxn.PaymentTxn): void {
    assert(
      payment.receiver === Global.currentApplicationAddress,
      "Wrong receiver",
    );
    assert(payment.amount >= Uint64(1_000_000), "Insufficient payment");
    this.credits.value = this.credits.value + Uint64(1);
  }
}
```

If this used `gtxn.PaymentTxn(0)`, multiple application calls in a padded group
could read the same payment and credit it repeatedly. Exact group-size checks
can prevent that narrow attack but reduce composition. Prefer a one-to-one ABI
transaction reference unless the protocol deliberately fixes the entire group
shape.

## Audit atomic-group composition

Ask:

- Can one payment, asset transfer, oracle update, or authorization transaction
  satisfy more than one application call?
- Can an attacker pad or reorder the group without invalidating a check?
- Does relative position matter, and is it proven?
- Can a LogicSig transaction be reused at several group positions?
- Does the application rely on a transaction before or after it without
  binding that relationship?
- Are group-wide state changes safe under repeated application calls?
- Does an inner application call expose a reentrant-like sequence through
  another application in the same group or call tree?

Algorand groups execute atomically, but atomicity does not prevent semantic
double use. Trace the identity and consumption of each economic input.

## Review fee flow

The group pools fees. PuyaTs defaults inner-transaction fees to zero so outer
transactions fund them through the pool. Review the pinned compiler and
generated TEAL, then flag explicit nonzero inner fees unless the design has a
bounded, documented reason. A repeated permissionless call with app-paid inner
fees can drain the application account.

Do not hard-code an assumed network minimum. Where a LogicSig needs a fee
bound, compare against `Global.minTxnFee` or a deliberate narrow policy; see
[Logic Signatures](logic-signatures.md).

Check that clients estimate enough pooled fee for every possible inner
transaction path. Insufficient pooled fee is often availability or integration
risk rather than theft, but app-paid fees can become direct loss.

## Keep dangerous inner fields out of caller control

Review every inner payment and asset transfer for:

- `rekeyTo`;
- `closeRemainderTo`;
- `assetCloseTo`;
- asset sender or clawback behavior;
- receiver, asset, and amount;
- fee.

Omitted close and rekey fields are safer than accepting caller-supplied values.
If a migration intentionally uses one, verify strict authorization, fixed
destination, one-time state transition, asset accounting, and tests.

## Validate ABI inputs semantically

Default ARC-4 encoding validation establishes that an encoded value has the
declared shape. It does not establish application-level limits. Review:

- maximum length for dynamic strings and bytes;
- exact length for hashes, commitments, IDs, and fixed records;
- lower and upper bounds for amounts, rates, windows, and basis points;
- membership in the supported enum or phase set;
- uniqueness and ordering when arrays represent sets or sequences;
- cross-field relationships such as deadline ordering or amount/price bounds.

If method validation is disabled or raw argument bytes are decoded manually,
the contract must validate encoding as well as meaning.

## Audit ASA identity and control

When receiving an asset, validate `xferAsset`, receiver, amount, and any sender
policy. Otherwise an attacker can substitute a worthless ASA.

For ASA creation, review the intended manager, reserve, freeze, and clawback
addresses. Empty control addresses permanently remove those capabilities.
Confirm that immutability or retained control is deliberate.

For ASA reconfiguration, every control address that should remain must be
re-specified. Omitted addresses are permanently cleared:

```typescript
const result = itxn
  .assetConfig({
    configAsset: asset,
    manager: nextManager,
    reserve: asset.reserve,
    freeze: asset.freeze,
    clawback: asset.clawback,
    fee: 0,
  })
  .submit();
```

Also verify who can initiate reconfiguration and whether transferring manager
authority uses an intentional acceptance or recovery model. Review destruction,
clawback, freeze, and reserve semantics as separate privileges.

## Review replay and public values

Every non-idempotent method needs a uniqueness or state guard. Ask what happens
when a claim, vote, withdrawal, settlement, or configuration action runs twice.

A secret or hash preimage revealed in the same pending call that performs a
payout can be copied and front-run. If secret-based authorization is required,
bind a prior commitment to the complete intended action, separate commit and
reveal across confirmed rounds, and define expiry and cancellation. Never
assume application arguments are private.

## Consider flow limits

Atomic groups can support multi-step flash-loan-style manipulation. For
liquidity, lending, oracle, or treasury flows, assess:

- whether price or accounting state can be manipulated and consumed in one
  group;
- maximum value that can leave per call, group, round, and time window;
- whether a token-bucket or other rate limit bounds exploit impact;
- whether the limit itself can overflow, be bypassed through alternate paths,
  or permanently deny service.

Rate limiting limits blast radius; it does not repair incorrect pricing or
accounting.
