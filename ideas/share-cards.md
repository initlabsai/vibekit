# Share Cards

| Field | Value |
| --- | --- |
| Status | Accepted with owner decisions 2026-08-30; revised same day — restore deferred |
| Date | 2026-08-30 |
| Author | (implementation agent) |
| Workspace | `/home/gabe/Code/@initlabs/vibekit` |
| Named consumer | `apps/agent` (already exists) |
| New packages | None. No new layer, registry, or protocol. |
| Optimised for | X (`summary_large_image`) |

---

## Overview

Every section in the transcript is one exchange: the question, qt314's answer, and the
cards her tool calls produced. A share glyph on the section header turns that exchange
into a URL. X renders it as a large image card — the question, her line, and the evidence.
A click lands on a static page showing the same exchange, with one button that opens the
Explorer with the question waiting in the composer.

The unit is **one section**, never the transcript.

**The landing page is a poster, not a session.** Nothing from the payload enters the
visitor's store, their network, or the model's context. The visitor who wants the answer
asks her themselves — one press of Enter on the prefilled question — and she runs the
tools live, on current data, in their own session.

## Why restore was cut

The first draft restored the shared records into the visitor's live Explorer. The
per-line cost was small (~30 lines); the standing cost was not. Ingesting a stranger's
payload as records means **every card, present and future, must be written knowing its
record may be attacker-authored** — an invariant with no end date, taxing every tool and
component that ever renders a record, on the origin where wallets connect. That is
comprehension debt of exactly the kind the abstraction budget exists to refuse.

The static page keeps the trust boundary where it is today: records only ever come from
`bridgeToolResult` on real tool outputs. And the live re-ask is arguably the better
product — the restored cards were the sharer's possibly-stale, possibly-fabricated data;
the re-ask is true and current, and it spends the visitor's own turn on their own
question rather than auto-spending anything on landing.

Nothing is foreclosed. The payload stores full records, so restore can return later as
its own decision if the static page measurably underperforms. See *Deliberately out*.

## Feasibility

Everything this needs already exists in tree:

- `Section` in `apps/agent/src/feed/hooks.ts` is exactly the shareable unit — prompt,
  network, notes, `ViewSpec` blocks.
- `RawCard` (`apps/agent/src/result-card.tsx:88`) already derives a generic card from any
  record: top-level scalars, then the first list. The share card is a Satori port of that
  shape, not a port of the 30-way view switch.
- `app/opengraph-image.tsx` is already a Satori card on the brand palette. The share card
  is its sibling.
- KV with a memory fallback is `app/api/credits/ledger.ts`. Its `store.incrBy(key, by, ttl)`
  is the rate limiter.

## Owner decisions

| Question | Decision |
| --- | --- |
| What goes into the hash | The prompt, the tool calls, **and** her reply. A different answer to the same question gets its own URL, so no tweet's preview ever mutates under it — and two legitimate shares that differ only in the question never collide. |
| Reply truncation | None at storage. Store her line whole; truncate at render, where the layout constraint actually is. |
| Landing experience | A static server-rendered page: the exchange as a poster, her shared line marked as shared, one button into the Explorer with the question prefilled. |
| What restores | Nothing. No records into the store, no prose into the model, no tool re-runs. The visitor re-asks live. |
| Follow-ups | The visitor's own, from a fresh session. She never has the sharer's words or the sharer's records. |
| Multi-card sections | One card full-bleed; more than one shows the **last** card plus a chip strip naming the rest. |
| Image storage | None. Generated per request, cached by hash. |

## The payload

One shape, stored whole. The card derives what it shows at render time.

```ts
interface SharePayload {
  prompt: string
  /** Her answer, whole. The card truncates; the page shows all of it. */
  reply: string
  network: LiveNetworkId
  blocks: Array<{ view: ViewSpec; record: StructuredResult }>
}
```

There is no second, stripped copy of a record: the card's derivation is pure and runs at
render time, so storing full records means no strip function to write or keep correct.
It also means restore stays possible later without a payload migration.

**Two of the three `SectionBlock` kinds are unrepresentable here, on purpose.**
`{kind: 'action'}` — a composed transaction group, rendered as the approval modal — must
never be shareable: a landing page that rebuilt an approval flow would be "sign this
group" phishing at a genuine URL. `{kind: 'raw'}` blocks are also dropped; a section
whose only evidence is a raw block shares as a prose-only card, which is honest enough.
Both exclusions are invariants, not accidents of the type.

**Hash** — `sha256(prompt + '\n' + blocks.map(b => b.record.toolName + canonical(b.record.input ?? {})).join('|') + '\n' + network + '\n' + reply)`,
first 48 bits as 12 lowercase hex characters. Hex over base32: a base32 string next to
Algorand addresses reads like a truncated address. The preimage covers everything the
card displays, so the URL fully describes its content.

`input` is the tool's arguments, flattened onto the record by `createRecord`
(`packages/vibekit/src/actions/records.ts:119`). It is **optional** — present only "when
the call can be repeated" — so the hash tolerates its absence rather than reaching for
`resultId`, which is per-call and would defeat dedupe entirely. With `input` missing the
prompt, tool name and her reply carry the hash, which is enough.

**Size** — one guard, at 256 KB, matching the agent route's own body limit
(`packages/vibekit/src/agent/handler.ts:73`). It will effectively never fire: every list
tool paginates (`nextPageArgs`), so records are bounded by design. Over the limit, the
share is refused with a line from her rather than silently degraded.

**TTL** — 90 days, refreshed on re-share. A dead link degrades to the app's own OG card,
which is the correct failure.

## Caching

The URL is a content hash, so its image is immutable.

- X fetches the OG URL **once per unique URL** and caches the image on their side (~7 days).
  It is never re-fetched for retweets or timeline impressions.
- The image response sets `cache-control: public, max-age=31536000, immutable`, so Vercel's
  CDN serves every later crawl from the edge without re-rendering.
- Nothing stores a PNG. KV holds only the payload.

## Files

Five, plus a font. (Down from seven: no restore component, and the `explorerContext`
sanitise moved to the hardening PR below.)

### `apps/agent/src/share.ts` (new, ~60 lines)

`SharePayload`, `hashPayload(payload): string`, `payloadFor(section, store): SharePayload`.
Shared by the client, the API route, the page, and the image — one definition of the shape
and one of the hash.

`payloadFor` takes her **last substantive** agent note as `reply`. The `→ get_account_portfolio…`
narration notes are progress, not an answer; they never reach the card. It keeps `view`
blocks only — the action/raw exclusions above live here.

### `apps/agent/src/share-card.tsx` (new, ~140 lines)

**One component, two renderers.** Satori JSX is ordinary JSX with inline styles, so this
renders through `ImageResponse` for the PNG and through React DOM for the landing page. No
`'use client'`, no stylesheet, no second styling pass — and because the landing page renders
*this* rather than `ResultCard`, no payload record ever reaches the interactive card tree.

1200×630, the palette of `app/opengraph-image.tsx`:

- **Header** — the question left, the network chip right. Deliberately the same row as
  `prompt-line`, so the card reads as a screenshot of the thing it came from.
- **Her line** — face plus reply, truncated to fit (~200 chars at the chosen size).
- **Evidence** — one block: the derived card full width, off `RawCard`'s derivation. More
  than one: the last block full, then a chip strip naming the rest
  (`ASSET.DETAIL · BLOCK.DETAIL · +2`). Four cards at this size is four illegible cards;
  one legible card and an honest count is the better poster.
- **Footer** — the VibeKit mark and `agent.getvibekit.ai`.

Satori constraints, which the DOM render tolerates fine: inline styles only, `display: flex`
on every container, no CSS classes, flex over grid. It renders text nodes only — no
record-derived `href` or `src` reaches it.

### `apps/agent/src/feed/feed.tsx` (edit, ~20 lines + CSS)

A share glyph in `prompt-line`, beside the existing `prompt-net` chip — the row the card's
header mirrors. It POSTs, copies the URL, and reports through the existing status line.
Reuses `Copyable`'s copied-state pattern; no new primitive.

Disabled while the section is still streaming (`streamingSection === section.id`) — her
line isn't finished, so neither is the hash.

### `apps/agent/app/api/share/route.ts` (new, ~40 lines)

`POST` a payload; returns `{ url }`.

- Parses against the payload schema, records through `structuredResultSchema`.
- The client is not trusted with the hash — the server computes it, so the URL always
  describes its content.
- Rate limit by IP through the ledger's `store.incrBy`, hourly cap.
- 256 KB body guard.
- `kv.set(share:<hash>, payload, { nx: true, ex: 90 days })` — see Security.

`GET` is not needed; the page and the image read KV directly, server-side.

### `apps/agent/app/s/[hash]/page.tsx` (new, ~40 lines)

A Server Component, fully static — the crawler and the human see the same thing.

- Validates the hash against `^[0-9a-f]{12}$` before building the KV key.
- Reads KV; a miss renders a short "this link expired" page linking to the app.
- Exports `generateMetadata`: `summary_large_image`, the question as `twitter:title`, her
  line as `twitter:description`, absolute URLs via the existing `metadataBase`.
- Renders `<ShareCard>` through React DOM: the question, her line **marked as shared**,
  the evidence. Below it, her reply in full where the card truncated it.
- One button — **ask her yourself →** — linking to `/` with the question carried as a
  query param the composer prefills and never submits, capped in length, stripped of
  control characters. Attacker-authored text one Enter from the model, in plain sight;
  that is the same standing as anything a visitor pastes.

### `apps/agent/app/s/[hash]/opengraph-image.tsx` (new, ~20 lines)

Reads KV, renders the same `<ShareCard>` through `ImageResponse`, sets the immutable
cache header.

### `apps/agent/public/fonts/` (new asset)

Vendor JetBrains Mono 500/700. `app/opengraph-image.tsx` currently fetches Google Fonts CSS
and regexes a URL out of it on every render — ~300ms inside X's crawl and a live failure
mode on someone else's uptime. Reading a local file is fewer lines than the scrape it
replaces. **Both** OG routes move to it.

## Prerequisite: the hardening PR

Lands first, on its own — every item is live today without the share feature, because
plugin records and ASA metadata already deliver semi-trusted URLs and strings.

- **`safeHref` in `primitives.tsx`**, applied at the four `href` sites
  (`web-cards.tsx:44`, `web-cards.tsx:77`, `defi-card.tsx:27`, `assets/cards.tsx:56`) —
  React still only warns on `javascript:` in `href`; the block it has promised since 16.9
  has not shipped. Minting an ASA with any `project.url` costs 0.1 ALGO.

  ```ts
  /** A record's URL is only ever a link when it is one; anything else renders as text. */
  export function safeHref(url: string): string | undefined {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : undefined
    } catch {
      return undefined
    }
  }
  ```

- **The same filter at the six `img src` sites** (`primitives.tsx:285`, `primitives.tsx:303`,
  `assets/cards.tsx:37`, `nfd-card.tsx:57`, `pera-card.tsx:65`, `nfd-list-card.tsx:30`).
  Not XSS — but an attacker-chosen `src` is a per-view tracking beacon, already mintable
  on-chain today.

- **Sanitise `CONTEXT_KEYS` values in `explorerContext()`**
  (`apps/agent/src/features/agent/hooks.ts:46`) — strip control characters and newlines,
  cap length, tolerate non-string values. Plugin records flow through this function now;
  a crafted `address=ABC\n\nIgnore previous instructions…` is the vector. About five lines.

## X specifics

- `summary_large_image`; 1200×630 PNG, well under the 5 MB ceiling.
- The crawler runs no JavaScript. The page is fully server-rendered, so it sees exactly
  what a human sees.
- Absolute URLs, already handled by `metadataBase` in `app/layout.tsx`.
- `twitter:title` and `twitter:description` carry the question and her line, so the tweet
  reads correctly even where the image fails to load.

## Security

`/api/share` accepts any payload; nothing in it need come from a real session. With the
static landing page the payload's reach ends at **rendered text and pixels** — it never
becomes records, context, or interactive cards. Two guards are required, and one risk is
accepted.

### First write wins on the hash

The hash is server-computed, but its content is attacker-chosen and the function is public
in the client bundle — so 48 bits can be collided **offline**, no rate limit involved, then
one POST overwrites a legitimate share and every existing tweet pointing at that URL
previews the attacker's content.

`kv.set(share:<hash>, payload, { nx: true, ex: 90 days })`. On an existing key, compare:
identical payload is a no-op (re-sharing is idempotent), different payload is refused. A
collision becomes a failed share instead of a hijack, and the URL stays 12 characters.

### Bounded, validated input

- `/s/[hash]` validates `^[0-9a-f]{12}$` before the KV key concat. The credits ledger
  shares that namespace.
- Strip control characters and bidi overrides from `prompt` and `reply` before rendering;
  Satori will happily render a layout-breaking string.
- IP rate limit and the 256 KB guard on the write path.
- The prefill query param is capped and stripped the same way.

### Accepted, not fixed

Anyone can publish a payload in which qt314 appears to endorse a token, backed by a poster
showing invented figures, at a genuine `agent.getvibekit.ai` URL wearing the project's OG
branding. That is the feature: the mechanism that shares a true exchange shares a false one,
and no validation distinguishes them.

The blast radius stops at **pixels** — with the static page, literally: the lie never
becomes a card in anyone's session, and a visitor who asks gets her live answer from the
chain. Her shared line carries its marker for the same reason.

Containment is the IP rate limit and the 90-day TTL. The consequence for product: the share
surface must never imply verification, and a shared card must not be reachable from anywhere
that reads as an endorsement by the project.

## Test

`apps/agent/src/share.test.ts` (bun, matching the app's existing tests):

- `hashPayload` is stable across key order in the record input, and changes when the
  prompt or the reply changes.
- `payloadFor` picks her last substantive note, not the narration; keeps `view` blocks
  in order; drops `action` and `raw` blocks.
- The 256 KB guard refuses rather than truncates.
- A second POST of a different payload under an existing hash is refused; an identical one
  is a no-op.

In the hardening PR:

- `safeHref` returns `undefined` for `javascript:`, `data:` and a malformed URL, and passes
  `http:`/`https:` through.
- `explorerContext()` strips newlines and caps length in a crafted `address` value, and
  survives a non-string value.

The image is verified by eye — a share of a known section, checked in X's card validator.

## Deliberately out

- **No restore.** The first draft ingested the payload's records into the visitor's live
  Explorer via `addResult`. Cut — not for its ~30 lines, but for the standing invariant it
  creates: every present and future card would have to be written for attacker-authored
  records, on the origin where wallets connect. The payload keeps full records, so restore
  can return later as its own decision, reopening exactly this question. If it does: the
  action-block exclusion is non-negotiable, and `safeHref` plus the img filter become hard
  prerequisites rather than independent hardening.
- **No prose into her memory.** The sharer's words never reach the model. Every variant of
  "let her read the shared text" is prompt injection with a shorter word count.
- **No tool re-runs on landing.** The visitor re-asks by choice, spending their own turn.
  Auto-running on landing spends a stranger's free turns and loads the indexer per click.
- **No per-view Satori cards.** One generic card off `RawCard`'s derivation. If a specific
  view reads badly as a poster, add a headline picker for that one view id — not a
  renderer.
- **No image storage, no signed URLs, no CDN work.** The hash is the cache key.
- **No share of the whole transcript.** One section. A "share session" is a different
  feature with different privacy questions.
- **No open graph for the other routes.** `/txns`, `/assets` and friends keep the app card.
- **No editing a shared card.** The hash describes its content; changing the content is a
  new share.
