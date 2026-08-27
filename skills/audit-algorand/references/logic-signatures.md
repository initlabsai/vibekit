# Logic Signatures

Use this guide whenever the scope contains a PuyaTs `LogicSig`, compiled smart
signature, delegated signature, or contract-account escrow.

## Identify the mode and exposed authority

A LogicSig approves a transaction when its program returns nonzero:

- **Contract account**: the program hash is an address with no private key.
  Anyone with the program can submit transactions from the funded escrow when
  the predicates pass.
- **Delegated**: an account owner signs the program. Anyone holding that signed
  program can submit approved transactions from the owner's account.

Delegated programs are as sensitive as private keys. A narrow program can
limit their authority, but the protocol has no direct revocation mechanism.
Rekeying the delegating account invalidates existing delegation signatures and
also changes control of the whole account, so incident plans must treat that as
a high-impact recovery action.

A delegation follows its authorizing address, not necessarily one original
sender. An account rekeyed to that authorizer may also use the delegated
program. If the policy is intended to authorize only one account, bind
`Txn.sender` to that exact account; otherwise document the broader authority.

Prefer an application when state, revocation, rich authorization, or evolving
logic is required. LogicSigs have no state and cannot be patched after their
address or delegation is in use.

## Build a complete field matrix

For every permitted transaction type, list every field that can change value,
authority, lifetime, or network scope. Mark each as:

- fixed to a template or constant;
- deliberately bounded;
- derived and validated against another transaction;
- intentionally unrestricted, with a documented reason.

At minimum, verify the relevant fields:

| Concern    | Required review                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------ |
| Rekey      | `Txn.rekeyTo === Global.zeroAddress` unless a tightly scoped rekey is the purpose                |
| ALGO close | `Txn.closeRemainderTo === Global.zeroAddress` for payments                                       |
| ASA close  | `Txn.assetCloseTo === Global.zeroAddress` for asset transfers                                    |
| Fee        | Deliberate upper bound, commonly `Txn.fee <= Global.minTxnFee` when fee pooling covers execution |
| Type       | Only intended transaction types pass                                                             |
| Sender     | Exact sender when a delegated program is account-specific                                        |
| Value      | Receiver, amount, asset/application ID, sender/clawback behavior, and other type-specific fields |
| Lifetime   | Exact or bounded `firstValid` and `lastValid` consistent with the authorization                  |
| Replay     | Lease and stateful pairing where needed; see below                                               |
| Network    | `Global.genesisHash` bound when cross-network reuse is unsafe                                    |
| Group      | Self-validation uses `Txn`; any `gtxn` reference is bound to group index and relationship        |

Do not stop after finding one missing check. A LogicSig is secure only if every
unrestricted field is compatible with its intended authority.

## Treat arguments as public caller input

LogicSig arguments are not covered by the delegation signature, transaction
ID, or group ID. Typed LogicSig parameters can validate their encoding, but the
caller still chooses their values. Raw `op.arg(...)` paths require manual count,
length, encoding, and semantic validation.

Never use an argument as a password, secret, caller identity, receiver policy,
amount cap, or other authorization gate. Template variables are compiled into
public bytecode and cannot keep secrets either.

## Prove replay semantics

A lease creates a `{sender, lease}` lock only through the transaction's
`lastValid` round. After that window expires, the same lease can be used again.

For at-most-once authorization without application state, bind all three:

- a unique lease;
- exact `firstValid`;
- exact `lastValid`.

If either validity bound remains caller-controlled, an attacker can submit a
short window, wait for expiry, and replay. If the authorization should repeat
at a controlled rate, specify and verify those semantics instead of describing
it as one-time.

A stateful application call in the same group can provide stronger replay or
quota checks, but the LogicSig must bind to that exact call and group relation.

## Validate the transaction being signed

Use `Txn` to validate the current LogicSig-authorized transaction. A program
that checks `gtxn(0)` without proving its own `groupIndex` can be attached to
several other group transactions while only the indexed transaction is
validated.

When group context is necessary, prove:

- the LogicSig transaction's exact group index;
- group size or composable relationship;
- every field of the paired application call or payment needed by the policy;
- that the same paired transaction cannot authorize multiple spends;
- that no extra transaction gains unintended authority.

## Review a bounded payment holistically

This pattern illustrates the minimum relationships for a one-time,
network-specific delegated payment. The intended application may require
additional fields:

```typescript
import {
  Account,
  Global,
  LogicSig,
  TemplateVar,
  TransactionType,
  Txn,
  Uint64,
  type bytes,
  type uint64,
} from "@algorandfoundation/algorand-typescript";

export class BoundedPaymentSig extends LogicSig {
  program(): boolean {
    return (
      Txn.typeEnum === TransactionType.Payment &&
      Txn.receiver === TemplateVar<Account>("RECEIVER") &&
      Txn.amount <= Uint64(1_000_000) &&
      Txn.fee <= Global.minTxnFee &&
      Txn.rekeyTo === Global.zeroAddress &&
      Txn.closeRemainderTo === Global.zeroAddress &&
      Txn.lease === TemplateVar<bytes>("LEASE") &&
      Txn.firstValid === TemplateVar<uint64>("FIRST_VALID") &&
      Txn.lastValid === TemplateVar<uint64>("LAST_VALID") &&
      Global.genesisHash === TemplateVar<bytes>("GENESIS_HASH")
    );
  }
}
```

Do not copy this as a universal solution. For asset transfers, also validate
asset identity, receiver, amount, close, and clawback semantics. For application
calls, validate application, on-completion action, arguments, accounts, assets,
applications, and group relationship required by the policy.

## Test the negative space

For each allowed transaction, create mutations that change one field at a time:

- rekey and close destinations;
- fee just above the bound;
- wrong sender, type, receiver, amount, asset, application, or network;
- reused lease and shifted validity windows;
- hostile LogicSig arguments;
- extra group transactions and different group indexes;
- replay after the original validity window.

The test suite should show rejection for every field the security policy
constrains. Compile and inspect generated TEAL so a source-level assumption is
not lost in code generation.
