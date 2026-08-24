# External systems and release

Use this guide for randomness, oracles, clients, compiler and artifact
verification, deployment assumptions, keys, monitoring, and incident response.

## Audit randomness as an asynchronous dependency

On-chain execution is deterministic, and public transaction or block data is
predictable or influenceable. Do not accept locally derived values as secure
randomness merely because they are hashed.

When a protocol uses the Algorand randomness beacon or another verifiable
source, check:

- the application commits to a future round before the outcome is available;
- value-affecting inputs close with a sufficient gap before that round;
- the request binds all domain and user data needed to avoid cross-context
  reuse;
- anyone, rather than only a party who benefits from withholding, can finalize;
- the protocol reads within the source's supported availability window;
- delayed or missing output cannot lock funds forever;
- backup rounds, timeout withdrawals, cancellation, or governance recovery do
  not let a party choose among known favorable outcomes;
- beacon application IDs and interfaces are verified for the target network;
- discontinuation or key compromise has a migration path with a documented
  trust model.

Beacon IDs, retention windows, and service timing can change. Verify them from
current official sources during a release review; do not rely on remembered
constants.

## Make oracle trust explicit

For every price, timestamp, proof, or off-chain fact, establish:

- authorized publishers and how keys rotate;
- data identity, units, decimals, sign, and valid range;
- publication time, accepted staleness, and round ordering;
- behavior for missing, duplicate, delayed, or contradictory updates;
- manipulation cost and whether one atomic group can both move and consume the
  value;
- fallback, pause, circuit-breaker, and recovery rules;
- whether multiple sources are genuinely independent;
- whether operators can front-run users or selectively withhold updates.

An access-controlled oracle can still publish economically invalid or stale
data. Validate both publisher authority and value semantics.

## Verify the compiler and artifacts

Treat compiler output as part of the trusted computing base:

1. Confirm PuyaTs is pinned by the package manager and compiler configuration.
2. Review current security bulletins for the pinned version.
3. Compile from the reviewed source with the project's normal command.
4. Test unoptimized output and the intended deployment optimization level when
   the installed compiler exposes supported project commands for both.
5. Investigate any behavioral divergence or compiler crash as security
   relevant.
6. Compare ARC-56, approval TEAL, clear TEAL, and source maps with the expected
   build inputs.
7. Verify deployed program bytes separately when deployment is in scope.

Do not regenerate artifacts over user changes during a read-only audit. Build
in the project's normal disposable output path or explain why artifact parity
could not be established.

Generated TEAL deserves targeted inspection for lifecycle routing, assertions,
inner-transaction fields, fee values, and optimization-sensitive branches.
Source review alone cannot establish deployment parity.

## Treat clients as untrusted convenience layers

Generated clients improve type safety and transaction composition for honest
users. Attackers can bypass them.

Review clients and frontends for:

- transaction construction matching the contract's actual ABI and group
  assumptions;
- fee and resource estimation for worst-case inner paths;
- network, application, asset, and signer identity confirmation;
- slippage, deadline, receiver, and amount presentation before signing;
- stale ARC-56 artifacts or method selectors;
- unsafe defaults that cause users to rekey, close, overpay, or authorize a
  different group than displayed.

Every security-critical constraint must remain enforced on-chain. Report a
client-only check as an on-chain vulnerability only when the contract relies on
it.

## Review deployment and privileged keys

For contracts controlling significant value, review whether update, delete,
ASA control, oracle, pause, and treasury authorities match the documented
operational model.

Check:

- high-impact authority uses an appropriate multisig or equivalent policy;
- the threshold avoids both one-key control and impractical all-key recovery;
- multisig member ordering is recorded consistently;
- keys are separated and can be rotated without locking the protocol;
- mnemonics, private keys, and delegated LogicSigs are absent from source,
  logs, fixtures, and versioned configuration;
- application accounts are not rekeyed to a single externally owned account
  that can bypass all application logic and drain assets directly;
- immutable deployments actually omit update/delete paths and handle any
  creator authority deliberately;
- deployed approval and clear programs match reviewed artifacts;
- network and application IDs are verified rather than inferred from UI state.

Do not request or expose seed material during an audit. Load `use-vibekit`
before any account, signing, deployment, or on-chain verification action.

## Distinguish algod from indexed history

Indexer data is eventually consistent. Do not use an indexer response as the
sole real-time confirmation of a security-critical transaction. Confirm pending
or recent transactions through algod when operational behavior depends on
finality timing.

For mission-critical systems, document reliance on third-party nodes, their
failure and censorship modes, and the fallback strategy. Off-chain APIs and
frontends also need ordinary web-security review; keep those findings separate
from AVM findings unless the trust boundary crosses both.

## Assess monitoring and incident response

The response plan should connect on-chain powers with operational detection.
Review monitoring for:

- update and delete attempts;
- role, manager, freeze, clawback, oracle, and pause changes;
- large, rapid, or structurally unusual value movement;
- repeated failures that suggest probing or denial of service;
- compiler or dependency security advisories;
- beacon and oracle availability.

Identify who receives alerts, who can pause or recover, expected response time,
and how users are informed. A kill switch is useful only when critical methods
obey it and authorized operators can invoke it before the assumed loss window.

## Set an appropriate release conclusion

For a mainnet-readiness review, report separately:

- code findings;
- unverified deployment or artifact assumptions;
- privileged-key and operator trust;
- external availability and data integrity;
- monitoring, pause, upgrade, and user-exit readiness;
- test and analysis coverage.

Recommend an independent professional audit and a responsible-disclosure or
bug-bounty process for systems holding significant user value. That
recommendation does not replace concrete findings from the current review.

Canonical verification starting points:

- [Algorand smart-contract concepts](https://dev.algorand.co/concepts/smart-contracts/overview/)
- [PuyaTs security policy](https://github.com/algorandfoundation/puya-ts/blob/main/SECURITY.md)
- [Puya compiler security bulletin](https://dev.algorand.co/bulletins/puya-issues-27-10-2025/)
- [Algorand randomness](https://dev.algorand.co/concepts/protocol/randomness/)
