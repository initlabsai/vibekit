# Doctrine — the bets VibeKit is built on

Owner: Gabriel Kuettel · shaped 2026-08-16 · status: **normative until falsified**

This document states the operating theory behind the architecture, so that no
contributor — human or agent — optimizes a local decision at the expense of the
thesis. Read it before proposing structural changes; DESIGN.md says *what* was
decided, this says *why the whole thing exists*.

## The thesis

**Machines handle the machine code; the human handles vision and architecture.**
VibeKit is both built this way and built *for* developers who work this way.
The thesis has three legs, each a falsifiable bet.

### Bet 1 — Delegated implementation

High-level guidance plus good architecture plus capable models produces shippable
code **without line-by-line human review**. If the owner had to verify every line,
they might as well handwrite it — the entire point collapses.

*What makes it safe:* not trust — structure. One tool contract, thin hosts, no
shared mutable state, typed errors. Bad code has few places to hide and fewer
places to spread.

*The precision carve-out:* some nodes demand exactness that would destroy velocity
to build in-house (private keys, sealing, signing). Those are **bought, not
built** — outsourced to specialized, purpose-built components (keystore-node by
the Algorand Foundation), pinned exactly, isolated behind our interfaces.
Outsourcing is a *tracked dependency, not an absolution*: we verify our usage,
watch upstream's audit posture, and never assume their internals.

*Falsified if:* field sessions or reviews repeatedly find defects that trace to
unreviewed generated code rather than to integration seams — that would mean the
architecture is not containing what verification misses.

### Bet 2 — The engine makes surfaces cheap, and surfaces are the product

A stateless, contract-driven, well-verified core makes every interface a thin
adapter: MCP, CLI, orchestrator, hosted API, React app, *whatever*. In a post-AGI
environment this is not a convenience — **maximizing the contexts through which
agents can do work is the product strategy**. The multiplicity of doors (MCP for
harnesses, `vibekit tool` for shells, orchestrator for hosted heads) is deliberate
coverage, not sprawl: each door exists because a real class of agent enters
through it.

*The measured evidence so far:* MCP adapter ~40 lines, CLI door ~140, orchestrator
bridge ~30; deleting an entire TUI changed the engine by zero lines; a new tool
appears in every door at once.

*The obligation that comes with it:* **every door is attack surface as well as
work surface.** A new surface ships with its safety posture stated (who gates
writes, where credentials sit, what an injected prompt could reach) — or it does
not ship.

*Falsified if:* a new head (the Phase 7 API is the test) requires engine rework
rather than adapter work, or a door ships whose marginal cost exceeded a few
hundred lines — either means the abstraction is leaking and "cheap surfaces" is
wishful.

### Bet 3 — Delegated verification

Machines verify the machine code. Verification is not an afterthought of
delegated implementation — it is the thing that makes delegation sound. Three
rules, all already practiced, now law:

1. **Tests land with code** — no untested change (AGENTS.md hard rule).
2. **Live end-to-end beats simulated** — real chains, real daemons, real agents;
   a txId on-chain is the only proof that counts.
3. **No artifact is accepted on its author's verification alone.** The author of
   code, tests, and docs has *correlated blind spots* — the same mind misses the
   same things three times. Fresh contexts (different agents, adversarial reviews,
   field sessions the author didn't script) are a required stage, not a luxury.
   Reviews read the code before the narrative.

*Falsified if:* an adversarial review or field incident reveals a defect class
that our verification pipeline was structurally unable to catch (not merely
didn't) — then the pipeline, not just the code, gets redesigned.

## Relationship to Clean Architecture

The alignment is real and deliberate: the dependency rule (the engine knows
nothing of its hosts), frameworks as details (harnesses, Ink, even MCP itself are
delivery mechanisms — one was deleted to prove it), boundaries at the I/O edges,
entities as schemas (zod at the boundary is the entity layer). **Double down on
the principles; do not overfit to the liturgy.** We deliberately skip the
ceremony that doesn't pay here: no repository-pattern indirection over a chain we
don't own, no use-case classes where a `ToolDefinition` already is one, concrete
pinned dependencies behind small interfaces instead of speculative abstraction.
When a Clean Architecture instinct and a measured line-count disagree, the
line-count wins.

## Operating rules distilled (for any agent working here)

- State additions are design smells until proven otherwise (§10). "We need to
  store this" gets challenged, not implemented.
- Per-tool code in a host is a bug in the making — hosts are generic adapters.
- Secrets: agents wield capabilities and see metadata; plaintext never crosses a
  tool-result boundary; credentials enter via human channels (§6).
- Buy precision, build velocity: pin exactly, isolate behind interfaces, track
  upstream.
- Keep the big picture reachable: docs/ is the institutional memory — DESIGN.md
  (what/why decided), HANDOVER.md (current state), this file (why it exists at
  all). An agent that can't see the forest reads these before touching trees.
- Every claim of "done" carries its verification: test run, txId, or field
  transcript.

## What this doctrine is not

Not a claim that models are infallible, that review is obsolete, or that
security can be fully outsourced. It is a claim about **where scarce human
attention buys the most**: vision, architecture, doctrine, and the one-time
grants only humans can make — with everything else delegated to machines *and*
machine-verified, adversarially, by parties who didn't write it.
