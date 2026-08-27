# Handover — collapse the npm packages into one `@initlabs/vibekit`

For an agent with fresh context. Read `AGENTS.md` (the abstraction budget rule)
and `docs/PRODUCTION.md` (traps) first. Everything below was verified
2026-08-27. Delete this file once the consolidation ships.

## Why

Ten published packages carry ~5,900 lines, and they are not independent
artifacts — they are one artifact in ten wrappers:

| package | LOC | |
| --- | --- | --- |
| tools | 2342 | |
| core | 1328 | every other package depends on it |
| agent | 676 | |
| signer-keystore | 586 | |
| plugin-alpha-arcade | 224 | |
| plugin-nfd | 218 | |
| plugin-vestige | 178 | |
| plugin-pera | 140 | |
| mcp | 128 | |
| preset | 74 | a barrel that imports the other six |

Everything is versioned in lockstep at `1.0.0-alpha.0`. `preset` pulls in
plugins + signer + tools, so the batteries-included consumer installs all ten
regardless. The split costs ten `package.json`s, ten release entries, and the
`workspace:*` drift trap in `docs/PRODUCTION.md`, and buys no consumer
anything.

**Do it now.** The packages are hours old with zero dependents. After people
install them this becomes a breaking change.

## Target

One published package, `@initlabs/vibekit`, with subpath exports. Every
subpath below exists today and must survive:

```
.                      decide: see "Open decisions"
./core
./tools      ./tools/views
./agent      ./agent/config
./mcp        ./mcp/stdio      ./mcp/http
./signer-keystore
./preset
./plugins/nfd  ./plugins/pera  ./plugins/vestige  ./plugins/alpha-arcade
```

Stay private, unchanged, not published: `explorer` (5712 LOC, bundled into the
TUI binary), `apps/cli`, `apps/tui`, `apps/web`, `apps/website`.

## Shape of the work

215 files reference `@initlabs/vibekit-*`. By area:

```
packages/tools 69   apps/tui 43   packages/explorer 16   packages/mcp 12
apps/web 10   apps/cli 10   signer-keystore 7   agent 7   plugins 5 each
apps/website 4   skills/build-on-vibekit 3   verify/packed-consumer 2
turbo.json 1   README.md 1   root package.json 1
```

Dependency graph — `core` is the root, nothing is circular:

```
core        -> (nothing)
agent, tools, signer-keystore, plugin-*  -> core
preset      -> core, tools, signer-keystore, all four plugins
mcp         -> core, preset, signer-keystore
explorer    -> core, tools                  (private)
apps/cli    -> everything except explorer
apps/tui    -> agent, core, explorer, signer-keystore, tools, 3 plugins
apps/web    -> explorer
```

Do not miss these non-obvious consumers:

- `skills/build-on-vibekit` documents the package names, and the CLI bundles
  skills at build time (`apps/cli/scripts/bundle-skills.ts`). Stale names ship
  inside the binary and get read by agents.
- `verify/packed-consumer/` has a `bun.lock` pinning tarball filenames
  (`initlabs-vibekit-<name>-1.0.0-alpha.0.tgz`). `bun run verify:packed` fails
  until it is regenerated.
- `.changeset/config.json` has a `fixed` group of `core`/`mcp`/`tools` that
  becomes meaningless with one package — remove it.
- `packages/mcp/examples` and `turbo.json`.

## Traps

- **Run `bun install` after any `changeset version`.** `bun pm pack` resolves
  `workspace:*` from `bun.lock`; a stale lockfile publishes a package whose
  dependencies point at versions that never existed. `verify:packed` does
  **not** catch this — read a packed tarball's `package.json` directly.
- `packages/explorer/test/recorded/mainnet-graph-corpus.json` re-records itself
  when tests run. Revert it; do not commit the churn.
- Changesets is in pre-release mode (`.changeset/pre.json`, tag `alpha`).
  `bunx changeset publish` applies the `alpha` tag on its own — passing
  `--tag alpha` is rejected in pre mode.
- npm auth is a granular token in `~/.npmrc` and works headlessly. Plain
  `npm login` does **not** — 2FA forces an interactive OTP per package.
- On a package's first-ever publish npm sets `latest` regardless of `--tag`,
  and will not let you remove it. `@initlabs/vibekit` will therefore have
  `latest` pointing at a prerelease until 1.0.0 ships.

## Retiring the ten old names

Published ~04:10 UTC 2026-08-27, so the 72-hour unpublish window closes
~04:10 UTC 2026-08-30.

- `npm unpublish <name> --force` is cleanest while they have no dependents.
- `npm deprecate <name> "moved to @initlabs/vibekit"` is the reversible option
  if the window has closed or you would rather leave a signpost.

Decide which, then do all ten consistently.

## Suggested order

1. Restructure `packages/` into the single package; keep git history with
   `git mv`. Update all 215 references.
2. `bunx turbo run build typecheck test` — 44 tasks must pass.
3. `bun install`, then `bun run verify:packed` (regenerate the consumer lock).
4. Read a packed tarball's `package.json` and confirm no `workspace:*` and no
   references to the retired names.
5. `bunx changeset version` → `bun install` → commit.
6. Tag `v1.0.0-alpha.1`, push, watch `release.yml` (4-OS matrix, 8 assets).
7. `bunx changeset publish`.
8. Unpublish or deprecate the ten old names.
9. Update `skills/`, `README.md`, and the docs to the new import paths.

## Open decisions

- **What lives at `.`?** Options: the `preset` surface (batteries-included,
  matches how the CLI wires itself), or `core` (types-first, smaller). This
  changes every consumer's top-level import, so decide before step 1.
- **Version.** `v1.0.0-alpha.0` binaries are already published and work — they
  are self-contained, so npm restructuring does not break them. But shipping
  `@initlabs/vibekit@1.0.0-alpha.0` built from a different tree than the
  existing tag is confusing. Cutting `v1.0.0-alpha.1` for both npm and the
  binaries keeps them honest. The installers resolve the newest `alpha` tag
  dynamically, so a new tag is picked up with no website change.

## State as of this handover

`main` is clean and pushed, CI green.

Shipped and verified tonight — do not redo:

- `v1.0.0-alpha.0`: GitHub prerelease with all 8 binaries; 10 npm packages
  published under the `alpha` tag.
- The install one-liners work end to end on Linux **and Windows**. CI runs
  `install.ps1` for real under Windows PowerShell 5.1 every push, and the
  Windows binary printed `vibekit v1.0.0-alpha.0` on a real runner.
- `install.ps1` was rewritten this session. Three bugs are fixed and each has a
  comment saying why: `Invoke-RestMethod` emits a JSON array as one pipeline
  object (which made the resolved tag every tag joined together), `Join-Path`
  throws on a null `$env:APPDATA`, and bare `irm getvibekit.ai/...` defaults to
  http, which PowerShell 5.1 will not follow to https.
- `doctor` now reports missing `node`/`npm`; a missing `node` used to surface
  as an opaque daemon start timeout.

Carry forward, unrelated to this work:

- **`/alpha` and `/alpha.ps1` are temporary.** They exist only to keep the
  one-liner short while there is no stable release. Delete them, their
  `vercel.json` header blocks, and the hero's channel handling when 1.0.0
  ships.
- `docs/PRODUCTION.md` has a *Deferred* entry, "A Node-free keystore," with a
  working prototype recipe.
- macOS binaries are still unverified by hand; the README platform table
  reflects that.
