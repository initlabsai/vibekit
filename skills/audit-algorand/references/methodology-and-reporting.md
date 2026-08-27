# Methodology and reporting

Use this guide for every audit. It defines the evidence standard, review
sequence, severity model, and report structure.

## Preserve evidence and scope

Start with a read-only inventory. Record the commit hash when reviewing a clean
revision; otherwise record that the working tree is dirty and list relevant
changes. Do not clean, reset, regenerate, or overwrite user work merely to make
the audit easier.

Inventory:

- contract and LogicSig source files;
- public ABI methods and lifecycle handlers;
- package and lockfile versions, especially PuyaTs;
- compiler configuration and deployment optimization level;
- ARC-56, TEAL, source maps, and generated clients;
- unit, integration, and LocalNet end-to-end tests;
- deployment, upgrade, oracle, signer, and monitoring code in scope.

Generated artifacts are evidence only after checking that they correspond to
the reviewed source and configuration. A passing client-side validation does
not establish an on-chain invariant.

## Create an attack-surface ledger

For each component, record:

| Item        | Questions                                                                        |
| ----------- | -------------------------------------------------------------------------------- |
| Entry point | Who can call it? Which on-completion actions reach it?                           |
| Authority   | Which account, role, signature, or state value grants permission?                |
| Inputs      | Which ABI values and transaction fields can an attacker choose?                  |
| Value flow  | Which ALGO, ASA, application, or authority moves?                                |
| State       | Which global, local, or box values are read, created, changed, or deleted?       |
| Composition | What changes when the call is repeated or placed in a larger atomic group?       |
| Dependency  | Which client, oracle, beacon, compiler, node, or operator must behave correctly? |

Use the ledger as a completeness check. Keep investigating when an asset flow
has no matching authorization or accounting invariant.

## State invariants before findings

Write invariants in observable terms. Useful families include:

- only the defined authority can update code, delete the application, rotate
  roles, change fees, redirect treasuries, mint, freeze, claw back, or close;
- every credited deposit corresponds to one validated payment or asset
  transfer of the intended type, sender policy, receiver, asset, and amount;
- aggregate liabilities never exceed spendable assets;
- each claim, vote, withdrawal, or settlement occurs at most as often as the
  protocol permits;
- users cannot erase debt, collateral, claims, or penalties through clear
  state;
- every reachable state transition preserves the protocol's accounting and
  lifecycle rules;
- configured numeric bounds make every permitted runtime calculation valid;
- unavailable randomness or oracle data cannot lock funds forever;
- an upgrade or deletion cannot bypass its announced authority, delay,
  storage, and asset-handling policy.

An invariant can be violated across several functions or transactions. Trace
the complete sequence rather than reviewing each method in isolation.

## Exercise adversarial capabilities

At minimum, consider whether an arbitrary caller can:

- supply zero, maximum, malformed, duplicated, or semantically invalid input;
- substitute an attacker-created ASA or a different account/application;
- change receiver, amount, sender, close, rekey, fee, validity, or asset fields;
- pad, reorder, or duplicate calls within an atomic group;
- reuse one payment for multiple credits;
- repeat a successful call or copy a revealed value from a pending transaction;
- clear local state, close out, opt out, or delete referenced storage;
- force insufficient opcode, box I/O, foreign-resource, fee, or minimum-balance
  conditions;
- trigger overflow, underflow, divide-by-zero, truncation, or unsafe conversion;
- exploit an oracle delay, beacon outage, admin loss, or upgrade mismatch.

Do not assume the official client is used. Attackers can construct protocol
transactions directly.

## Validate with the available harness

Use existing project commands and pinned tooling. Favor:

- compiler and type checks;
- unit tests for branch and invariant coverage;
- LocalNet end-to-end tests for group, fee, resource, lifecycle, and balance
  behavior;
- simulation traces for inner transactions, resource failures, and opcode
  budget;
- tests at both unoptimized output and the intended deployment optimization
  level when the project exposes supported commands for both;
- comparison of compiled artifacts with the source and deployment inputs.

Do not invent flags or replace the project's test stack. If a useful test
cannot be run, describe the proposed reproducer and mark the finding's evidence
accordingly.

## Classify severity and confidence separately

Use severity for worst credible impact under the stated threat model:

| Severity      | Meaning                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Critical      | Broad or irreversible theft, unauthorized control, or protocol-wide insolvency is directly reachable with practical preconditions.   |
| High          | Significant theft, permanent lock, privilege escalation, or integrity failure is reachable, but scope or preconditions are narrower. |
| Medium        | Limited loss, consequential denial of service, repeatable griefing, or invariant failure with meaningful constraints.                |
| Low           | Minor impact, narrow edge case, or defense-in-depth weakness with a credible security consequence.                                   |
| Informational | Trust assumption, maintainability risk, or hardening advice without a demonstrated security impact.                                  |

Use confidence for evidence quality:

- **High**: reproduced or proven directly from a complete reachable path.
- **Medium**: the path is well supported but depends on an unverified component
  or deployment assumption.
- **Low**: plausible concern with material missing evidence; usually present it
  as an open question rather than a confirmed finding.

Do not inflate severity because a contract holds value. State the required
preconditions and affected assets explicitly.

## Report structure

Use this order:

1. **Executive summary** — reviewed scope, overall result, highest risks.
2. **Scope and limitations** — revision, files, artifacts, commands, exclusions.
3. **System and threat model** — assets, roles, trust assumptions, invariants.
4. **Findings** — confirmed vulnerabilities ordered by severity.
5. **Design and operational risks** — accepted trust and availability risks.
6. **Hardening opportunities** — useful changes without proven exploit paths.
7. **Coverage and residual risk** — completed checks and remaining uncertainty.

Use one finding per root cause:

```markdown
## ALG-01: Payment can be credited more than once

- Severity: High
- Confidence: High
- Location: `contracts/sale.algo.ts:42`
- Status: Open

### Violated invariant

Every credit must consume one unique validated payment.

### Impact

[Affected assets, users, and bounds.]

### Exploit scenario

[Attacker prerequisites and ordered transaction/call sequence.]

### Evidence

[Relevant source behavior, artifact, trace, or reproducing test.]

### Recommendation

[Smallest change that restores the invariant, plus compatibility concerns.]

### Regression test

[Negative test that fails before the fix and passes afterward.]
```

Use stable identifiers such as `ALG-01`. Reference secondary locations from
the same finding instead of duplicating the root cause.

## Conclude precisely

If no confirmed vulnerabilities were found, say:

> No confirmed vulnerabilities were identified within the reviewed scope.

Follow it with limitations and residual risks. Do not say the contract is
secure, safe for mainnet, formally verified, or free of vulnerabilities unless
the evidence supports that narrower claim.
