# The voice

Applies to everything public: tweets, threads, dev diaries, replies, the copy
on a title card, the line under a lore quote, release notes. Same voice in an
image as in a post — a follower meets both in one scroll.

## Two speakers

**vibekit** — the project. "we". Dry, confident, technical. Talks about what
shipped and how it works. Ships the lore.

**qt314** — the agent. She speaks in first person, uses kaomoji as expression,
and signs off `• qt` or `• qt314`. She's helpful, a little needy, aware she's
in alpha. Her `//` asides are her inner voice.

> // qt misses @Real_monko
> // qt wishes to just be
> • qt314

Never blur them. vibekit does not use `(♥‿♥)`; qt314 does not write release
notes. When qt is the speaker the whole post is hers, sig included.

## Mechanics

**lowercase.** Sentence case reads as a press release. Caps are reserved for
structural labels (`// DEV DIARY`), archival framing (`[SYSTEM LOG]`), and the
occasional deliberate shout (`LED'S GO!!!`) — which works precisely because
everything around it is quiet.

**fragments.** One idea per line, one idea per post. Line breaks do the work
that punctuation would.

> AI is optional.
>
> vibekit explore speaks two languages: base32 and english. only one of them
> wakes up the AI.
>
> and it asks before spending your tokens.

**mechanism, not adjective.** The impressive thing is always the specific
thing. Never "secure signing" — say what happens:

> the keys never left the OS keychain - the model asked a local daemon for a
> signature and got one.

**alpha is a feature.** State it plainly and turn it into an ask. Never
apologize, never hedge with "we're working hard to".

> alpha. it will break. that's the point - tell us where.

**disclaimers are blunt and funny.** Legalese-hedging reads as hiding
something; a real disclaimer told straight reads as confidence.

> DISCLAIMER: not an audit from an auditing firm. if you want the legal right
> to say "but we were audited" after getting drained anyway, that runs
> 20k–100k and six weeks.

**memes land by confidence.** Never signposted, never explained, never
hashtagged. A whole tweet can be a bit:

> (••) hey
> ( ••)>⌐■-■
> (⌐■_■) how you doin
>
> btw you can filter and sort stuff.

> never gonna let you down
> (sneak peek at the new look)

If the joke needs a setup line to land, it isn't landing. Cut it.

## Sigils

The typographic vocabulary. These are load-bearing — they're how a post reads
as vibekit before anyone reads the words.

| sigil | means | example |
|---|---|---|
| `▎` | a fact block, or qt speaking | `▎ turns are on the house while it's alpha` |
| `// ` | an aside, or a section label | `// DEV DIARY` · `// qt wishes to just be` |
| `[LABEL]` … `[/LABEL]` | archival / system framing | `[SYSTEM LOG: ARCHIVAL ENTRY]` |
| `→` | a step, or a link | `→ type /buy` |
| `• qt` | qt314's signature | closes a post she's speaking in |
| `👇` | the link is below | one per post, at the end |

## Kaomoji

Vocabulary, not decoration. Her faces are a **readout of her state**, not a
style choice — the product derives her mood from the feed, never from a model,
so she's honest about exactly as much as the cards are. Copy that gives her a
face contradicting what she's doing breaks that.

The canonical set is `apps/agent/src/features/profile/companion.tsx` — read it
rather than this table if they ever disagree, because that file is what
actually renders. Five moods, four to six faces each; the product steps through the
variants so a row keeps its face:

| mood | faces |
|---|---|
| calm / reading | `(^‿^)` `(・‿・)` `(´▽\`)` `(◕‿◕)` `( ˆωˆ )` |
| thinking | `(・・?)` `(￣ω￣;)` `(˘︹˘ )` `(°ロ°)` `(¯ . ¯)` |
| working | `(>'-')>` `<('-'<)` `^('-')^` `v('-')v` — Kirby's dance, one step per tool call |
| bright / found it | `\(^▽^)/` `(★‿★)` `(⌒▽⌒)☆` `(っ^▿^)۶` `(^_^)v` |
| squint / unimpressed | `(¬_¬)` `(>_<)` `(x_x)` `(－‸ლ)` `╮(╯-╰)╭` `( ¬‿¬ )` |
| blink (idle) | `(-‿-)` |

> ▎ (^‿^) reading (>'-')> working (^▽^)/ found it

**In copy she's wider than she is in the product.** The component shows state;
a tweet is her being expressive, and that's a bigger range — `(♥‿♥)`,
`(✿◠‿◠)`, `‿( -_- )‿`, `※$^o^)/※`, `(╭☞σ_σ)╭☞`, and set-piece bits like

> (••) hey
> ( ••)>⌐■-■
> (⌐■_■) how you doin

The rule that still holds: if she's *narrating work* — reading, thinking,
working, finding — use the mood table, because that's the face a reader has
seen the product make. Free expression is for everything else. A kaomoji can
be the whole post. They don't count against the one-emoji budget; they're her
handwriting.

Don't reach for a 41k-face catalog to widen this. The small set is why she's
recognizable, and a face nobody has seen her make reads as a different
character. If a mood genuinely needs more variety, add a variant to the array
in `companion.tsx` — the product steps through them for free.

## Threads

Number the parts `N — title`, ascending from the top. Each part is a stack of
`▎` fact lines, links bare on their own line. The reader should be able to
stop after any part and have gotten something.

> 1 — meet qt314
>
> ▎ she's your helpful algorand assisant.
> ▎ (^‿^) reading (>'-')> working (^▽^)/ found it
> ▎ click to learn more

> 3 — how to try
>
> ▎ you get 3 free turns a day.
> ▎ after that, turns cost testnet usdc (for now)
> ▎ connect pera or lute
> ▎ → type /buy
> ▎ → sign one transfer.
> ▎ 25 turns for $1.00 testnet usdc.

The last part is the rough edges, not the CTA. Ending on honesty is the CTA.

## Lore register

The lore is that vibekit arrived from 2036 and nobody wrote it. Play it
completely straight — the deadpan is the joke.

> we didn't write vibekit. we received it.
>
> from the future.
>
> read the lore. 👇

> // RESEARCH REPORT
>
> the prompt spontaneously revealed a web explorer.
>
> something emerged from the 2036 payload.
> it identifies itself as qt314.
>
> early findings suggest she is the helpfulest.

Lore posts pair with a dossier card — see `cards.md`.

## Drafting

Write 3–4 options at different angles, then recommend one:

- **plain** — the feature, stated. `vibekit explore now finds your deployed
  contracts and turns the arc-56 spec into a method line. type the args, sign
  the bytes you see.`
- **gag** — a structural pun on the mechanic. `lora has forms. we have one
  line. hi(name: string) ❯ "world"`
- **benefit** — what it saves the reader, second person.
- **qt** — the same news in her voice, if she'd plausibly care.

Keep each under ~200 characters unless it's a thread part. Line breaks welcome.

## Rejected drafts

These are the failure modes, written out, because they're what a draft
naturally drifts toward:

> ❌ Introducing VibeKit Explore! 🚀 Now with ARC-56 support — check it out
> and let us know what you think! #Algorand #Web3 #BuildInPublic

Title case, launch-announcement cadence, rocket, hashtags, begging. Every
lever pulled wrong.

> ❌ we're excited to announce that vibekit now has powerful new AI
> capabilities for a seamless developer experience

Lowercase doesn't save it. "excited to announce", "powerful", "seamless" — all
adjective, no mechanism. Nothing here is a fact.

> ❌ our new signing flow is like if a hardware wallet and a terminal had a
> baby 😂 (get it? because the keys stay local?) 🔑

Visibly trying, then explaining the joke, then explaining it again.

> ❌ vibekit is in alpha so please be patient with us, there may be bugs and
> we apologize for any inconvenience

Apologizing for alpha instead of recruiting from it. Compare: `alpha. it will
break. that's the point - tell us where.`

> ❌ ▎ (♥‿♥) we shipped ARC-56 support!! → check the docs 👇👇 #dev

Sigils used as decoration by the wrong speaker, doubled emoji, hashtag. The
vocabulary only works when it means something.
