# Security

Review contracts as authorization and asset-custody systems. Expected
happy-path results are only one part of correctness.

## Threat model

Identify:

- assets and state the application controls;
- privileged accounts and how authority can change;
- all public ABI and bare-call entry points;
- accepted group and inner transactions;
- application update/delete policy;
- state-growth, fee, resource, and minimum-balance payers;
- off-chain assumptions such as indexers, frontends, facilitators, and oracles.

Any field supplied by a caller or neighboring transaction is adversarial until
the contract checks it.

## Review checklist

- Authorize by an explicit address or durable role; do not confuse transaction
  sender, asset sender, application account, and creator.
- Validate transaction type, sender, receiver, amount, asset/app ID, and all
  close/rekey fields relevant to accepted transaction arguments.
- Protect against replay or duplicate execution where the operation is meant
  to be one-shot. Use state, leases, rounds, or unique identifiers as the
  design requires.
- Check arithmetic bounds and use the intended AVM/ARC-4 width. Avoid unit and
  decimal conversions inside authorization or accounting logic.
- Make checks before state changes and inner transactions. Preserve atomicity;
  do not create partially committed multi-step protocols across calls without
  an explicit state machine.
- Bound user-controlled loops, bytes, arrays, logs, and box growth.
- Fund minimum-balance increases intentionally and reclaim storage only under
  authorized, well-tested rules.
- Set inner-transaction fees to zero unless the application account is
  deliberately paying a bounded fee. Otherwise, a caller can drain its
  balance by making it absorb fees.
- Restrict update and delete. If immutability is intended, make it a deployment
  and contract invariant rather than a UI promise.
- Keep clear-state logic safe under its special failure semantics: local state
  is cleared even when the clear-state program rejects. Never rely on that path
  for custody, debt settlement, or a required exit action.
- Do not log secrets or sensitive plaintext. Logs and state are public.

Simulation provides diagnostic evidence. A successful simulation against one
ledger snapshot does not replace contract checks or grant authorization.

## Evidence before release

Compile with warnings treated seriously, review generated TEAL/source maps,
run negative tests for every privileged and value-moving path, and exercise
compiled integration tests with realistic groups and balances. Use the
[Puya security policy](https://github.com/algorandfoundation/puya-ts/blob/main/SECURITY.md)
and current [smart-contract constraints](https://dev.algorand.co/concepts/smart-contracts/costs-constraints/)
as starting points. A high-value or externally administered contract needs an
independent security review beyond ordinary agent-generated tests.
