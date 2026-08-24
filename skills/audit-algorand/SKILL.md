---
name: audit-algorand
description: Perform structured security audits and adversarial reviews of TypeScript Algorand applications and LogicSigs compiled with PuyaTs. Use for vulnerability assessments, threat models, exploit analysis, mainnet-readiness reviews, security findings, and remediation guidance involving AVM contracts, generated TEAL or ARC-56 artifacts, transaction groups, assets, state, upgrades, or external dependencies. Excludes Python, deployment execution, generic implementation work, and non-security code review.
---

# Audit Algorand contracts

Audit the behavior an attacker can reach, then explain each issue through a
violated invariant and a reproducible path. A checklist is coverage support;
it is not evidence that a vulnerability exists.

This skill covers Algorand TypeScript and PuyaTs. Do not introduce Python,
PyTEAL, Beaker, or raw-TEAL implementation guidance. Load `build-on-algorand`
when the user also asks to implement fixes or needs broader PuyaTs application
guidance. Load `use-vibekit` before any deployment, signing, network, account,
LocalNet, or on-chain action.

## Establish scope before judging safety

Read the repository instructions, package manifests, lockfile, compiler
configuration, contract source, generated ARC-56 and TEAL artifacts, clients,
and tests that are in scope. Use the project's pinned commands and
dependencies. Do not add a dependency or change production code during an
audit unless the user explicitly asks for remediation.

Record:

- the reviewed commit or working-tree state;
- included contracts, LogicSigs, clients, artifacts, and tests;
- target network and active or assumed consensus protocol;
- compiler and optimization settings;
- excluded components and assumptions;
- whether generated artifacts match the reviewed source;
- commands that ran, failed, or could not run.

Treat missing source, stale artifacts, failing tests, and unverified deployment
bytecode as limitations. Do not silently fill those gaps with assumptions.

## Load the audit guides

Read [Methodology and reporting](references/methodology-and-reporting.md) for
every audit. Then load every guide whose feature appears in the system:

| Surface                                                                                | Guide                                                                          |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ABI methods, privileges, lifecycle handlers, upgrades, deletion, pausing               | [Applications and authorization](references/applications-and-authorization.md) |
| Payments, asset transfers, inner transactions, fees, atomic groups, ASA control        | [Transactions and assets](references/transactions-and-assets.md)               |
| Local/global/box state, clear state, MBR, state machines, accounting, numeric formulas | [State and arithmetic](references/state-and-arithmetic.md)                     |
| Contract-account or delegated smart signatures                                         | [Logic Signatures](references/logic-signatures.md)                             |
| Randomness, oracles, compiler and artifact verification, clients, keys, monitoring     | [External systems and release](references/external-systems-and-release.md)     |

For a full audit, load every applicable guide. For a focused review, state
which surfaces were intentionally excluded. If the code reveals a new surface,
load its guide before completing the review.

## Build the security model

Before searching for bugs:

1. Identify assets that can be stolen, frozen, minted, destroyed, redirected,
   or permanently locked.
2. Identify principals and authorities: arbitrary callers, users, admins,
   creators, multisigs, application accounts, LogicSig delegates, oracles, and
   off-chain operators.
3. Map every public entry point, lifecycle action, inner transaction, external
   application call, and state transition.
4. State the invariants that must hold across calls and atomic groups.
5. Separate intended trust assumptions from accidental privileges.

Assume an attacker can create accounts and assets, choose every unvalidated
argument and transaction field, arrange and pad atomic groups, repeat calls,
clear their local state, observe public values, copy pending transactions,
choose boundary values, and exploit unavailable external services. Treat a
compromised privileged key as a separate scenario unless the design claims to
tolerate it.

## Trace reachable behavior

For each entry point, trace:

- who can call it and how authorization is established;
- which arguments and transaction fields are attacker-controlled;
- state and asset reads before the call;
- state, balance, asset, authority, and lifecycle changes after the call;
- behavior when the call is repeated, reordered, grouped, interrupted, or
  supplied boundary values;
- assumptions enforced only by a client, deployment script, or operator.

Follow value across the entire path. A receiver check without an asset-ID
check, an admin check around unsafe arithmetic configuration, or a timelock
that never binds the proposed program bytes still leaves the relevant
invariant unproven.

## Corroborate findings

A confirmed finding needs all four elements:

1. an attacker capability or failed trusted component;
2. a reachable path through the reviewed system;
3. a specific violated invariant;
4. a concrete security impact.

Use source locations, existing tests, generated TEAL, simulation traces, or a
minimal reproducer as evidence. Prefer a focused negative test when the
project's harness supports one. Never execute an exploit against a public or
shared network. On-chain verification or writes require `use-vibekit` and the
user's authorization.

Do not report a missing best practice as a vulnerability without showing how
it changes reachable behavior. Put unexploitable hardening opportunities,
centralization assumptions, and incomplete evidence in their own sections.

## Finish with an auditable report

Use the report and severity model in
[Methodology and reporting](references/methodology-and-reporting.md). Sort
findings by severity, keep confidence separate from impact, and include a
regression-test idea with every remediation.

End with:

- coverage achieved and surfaces not reviewed;
- commands and artifacts used as evidence;
- unresolved questions and residual risks;
- an explicit statement when no confirmed findings were identified.

Avoid claiming that a review proves the absence of vulnerabilities or replaces
an independent professional audit for a high-value deployment.
