# Agentic marketing (hermes)

Status: idea, 2026-08-27. Cards and copy are close to ready; video is not.

Hand @getvibekit's campaign to an agent: it writes the copy, builds the
graphics, records the demos, and posts them. The lore series
(`apps/website/src/pages/lore.astro`) is the first test payload, because
inventing a fictional universe is unconstrained generative output with no rails
— if an agent can ship that safely it can ship anything.

## The four pieces are not equally hard

**Cards — done.** `skills/marketing-content/references/make-lore-card.sh` is
deterministic: env vars in, 1600x900 png out. `QUOTE` splits on `|` with the
last line in hero amber; `META` is `k=v;k=v`. The portrait is a photograph
rendered as ASCII (`lore-portrait-prep.py` → `lore-ascii.py`). An agent filling
the fields and shelling out is the easy 10%, and it cannot paint off-brand
because the layout and palette live in the script, not the prompt.

**Posting — trivial to wire, and the only one-way door.** Every other step in
this pipeline is free to retry. This one isn't. That asymmetry, not model
capability, is what should decide how much autonomy it gets.

**Video — where it actually breaks.** `SKILL.md` already documents the reason:
AI segments are a gacha, and the procedure is screenshot the last frame, read
the prose, re-roll until it's promo-safe. An agent can run that loop — it is
literally written as instructions to a model — but the failure is silent. A bad
roll doesn't error, it ships: raw state dumps, 404s on deleted entities,
confident nonsense about protocols. Add the moving parts (ttyd, live mainnet,
keystore daemon, agent provider) and the lesson that an unknown modal looks
exactly like a hang, and this is a month of hardening, not a weekend.

**Canon drift — the sleeper.** Today the lore's invented facts exist only as
example args in a shell script: Prior Art Directorate, Dr. Vera Solano,
entangled pair 004, personnel 001, 2036-02-11. Twenty drops in, an agent with
no memory of those will contradict them. A series that forgets its own story is
worse than no series.

## The line that must not be crossed

The lore page works because the fiction is clearly fiction and *the parts we can
prove* sits in its own section. An agent inventing lore is the product. An agent
inventing **capabilities** — a tool VibeKit doesn't have, an Algorand claim that
isn't true — is the failure that costs real credibility.

So the rule is about subject, not confidence: improvise freely inside the 2036
fiction; never generate a sentence about what the toolkit does or what the chain
supports without it coming from the repo. Cheapest enforcement is separation —
lore drops are one generator with no access to product claims, and anything
factual is a different, template-bound path.

## canon.md

One file the lore generator reads before writing and appends to after: names,
roles, dates, org designations, which numbered drop used which beat. Not a
database — a list it must not contradict. This is the smallest thing that turns
a sequence of one-off tweets into a series.

## Named consumers (abstraction-budget rule)

- The director card (personnel 001, Dr. Vera Solano) is the reference
  implementation — built by hand 2026-08-27, six planned drops behind it.
- The "AI is optional" promo (Aug 2026) is the video pipeline's only completed
  run, and its lesson list is the honest spec for what automating it requires.

## Do not build

A scheduler, a content calendar, a multi-platform abstraction, an approval UI.
The interesting claim is one agent that writes and ships; everything else is a
CMS. If posting stays human-gated, the queue is a directory of pngs and a text
file.

## Open questions

- Does the agent get the send button, or does it queue? Queueing keeps ~90% of
  the leverage and none of the tail risk, so the answer is probably "queue until
  the video path is trustworthy," but that is a taste call about how much the
  bit is worth.
- Video re-roll budget: how many bad takes before it gives up and asks, versus
  burning mainnet calls and tokens overnight.
- Whether lore drops post from @getvibekit or a separate in-universe account.
  Separate is funnier and quarantines the fiction from product claims for free.
- Portrait licensing: the current source is a royalty-free Pexels photo, and the
  photographer credit is not recorded anywhere yet.

## Copy that exists

Lead tweet for the director card:

> she sent one sentence back to 2026.
>
> the guy who received it went to make coffee.
>
> getvibekit.ai/lore

Quote-tweet announcing the pipeline:

> does an open source tool need scifi lore? no, this is absurd.
>
> but it's a fun way to test automated marketing pipelines.
>
> i'm handing @getvibekit's entire campaign to an agent — demos, "how to"
> videos, and lore drops it makes up as it goes.
>
> just gonna let it go and see where the story ends up.

Five more drops are outlined but unwritten: the channel, the block-production
log, the receiver (personnel 002), the payload/init commit, the MP3s.
