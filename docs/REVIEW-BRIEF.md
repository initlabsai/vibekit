# Adversarial Review Brief — VibeKit v2 (pre-1.0)

You are reviewing a codebase whose author also wrote its tests, its documentation,
its field-test scenarios, and its success narrative. **Do not trust any of them.**
Your job is to find what the author's correlated blind spots missed, before public
1.0 publication makes interfaces expensive to change. The repo is the evidence;
prose (including this brief's framing) is a claim to verify, not a fact.

Rules of engagement:

- Work from the code first. Read `docs/DESIGN.md` only *after* forming your own
  model, then diff the two.
- "It has a test" is not evidence — the author wrote the test. Judge whether the
  test would catch the failure you're hypothesizing.
- Verified findings only. For each: severity, concrete failure scenario
  (inputs/state → wrong outcome), and the smallest fix.
- Findings that merely restate the tracked gaps in `docs/HANDOVER.md` § Known gaps
  count as calibration, not discoveries — find those independently, then go past them.

## Review areas, ranked by stakes

### 1. Custody & secrets (highest stakes — never reviewed by anyone)

`packages/signer-keystore` — the signer, account lifecycle, sealed secrets, dispenser.

- Can secret plaintext or key material reach a tool result, an error message, a log
  line, or an AgentEvent under ANY path (including error paths and the 401-retry in
  `dispenser.ts`)?
- The §6 policy claims agents "cannot" leak credentials. Is that true by
  construction, or only when handlers behave?
- Token lifecycle: refresh race conditions, remove-then-put non-atomicity in
  `saveDispenserToken`, clock skew on `expiresAt`, multiple concurrent hosts
  refreshing against one secrets store.
- The daemon socket has no authentication beyond filesystem permissions. What can
  any local process do to a running daemon? Is that acceptable and documented?

### 2. Prompt-injection → funds movement (the composite threat)

This system gives LLM agents signing + faucet capabilities inside harnesses that
read untrusted content (web pages, package READMEs, chain data — note: **tool
results include attacker-controlled on-chain data** like asset names and note
fields).

- Trace: untrusted content → agent context → `send_payment`/`asset_transfer` with
  attacker's address. What stands in the way besides the harness's permission
  prompt? Do our tool descriptions, AGENTS.md, or skills make that gate easier or
  harder to slip?
- Do any read-tool results interpolate on-chain strings in ways a model would treat
  as instructions? Should results carry an untrusted-content framing?
- `vibekit tool` in execute mode signs with **no gate at all** (documented as
  "typing the command is approval") — but agents run shell commands. Is a
  Bash-approving harness + `vibekit tool send_payment` a gate bypass? Recommend a
  posture.

### 3. Interface stability under the Phase-7 consumer

`ToolDefinition`, `DeploymentOptions`, `AgentEvent`, the zod output schemas.
Pretend you are building the hosted API (multi-tenant, per-request BYOM +
tool-filtering, AgentEvents over HTTP to untrusted browsers, funded default model
with abuse controls):

- What is missing or wrongly shaped in these interfaces? What host assumption leaks?
- Is `AgentEvent` safe to stream verbatim to an untrusted browser client?
- Anything in the contract that cannot survive semver once published?

### 4. Environment portability

Everything was verified on one Arch Linux machine.

- Audit path/socket/keychain/provisioning assumptions for macOS and Windows
  (`keystore.ts` data dirs, `localnet` config dirs, Unix socket vs named pipe,
  `npm --prefix` layout differences, `bun build --compile` per-platform).
- The compiled binary is a known blind spot: `$bunfs` argv, embedded assets,
  dynamic imports. What else behaves differently compiled vs `bun run`?

### 5. Claims audit

Take DESIGN.md's handover snapshot and phase entries as a list of assertions.
Verify each against code and tests. Report every claim that is exaggerated,
stale, or unverifiable — this measures how far the narrative outran the artifact.

## Owner's additions

<!-- Gabriel: add your own suspicions here before dispatching the review.
     A brief scoped only by the author inherits the author's blind spots. -->

## Deliverable

Ranked findings (severity → scenario → smallest fix), then a one-paragraph verdict:
is this engine safe to publish as 1.0 and build a hosted product on?
