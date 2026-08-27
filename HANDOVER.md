# Handover — ship `v1.0.0-alpha.0`

For an agent with fresh context. Read `AGENTS.md` (release procedure) and
`docs/PRODUCTION.md` (open decisions and traps) first. Everything below was
verified 2026-08-26. Delete this file once the alpha ships.

## State

- `main` = `6e2690f`, pushed, working tree clean, CI green.
- Every package and both shipped binaries are at **`1.0.0-alpha.0`**, MIT.
- Changesets is in pre-release mode (`.changeset/pre.json`, tag `alpha`).
- **No `v*` tag exists yet.** Nothing is published to npm.
- `getvibekit.ai` is deployed and current, including `/install`.

Green: `bunx turbo run build typecheck test` (44/44) and
`bun run verify:packed`.

## Done

- `LICENSE` (MIT), `CONTRIBUTING.md`, stripped `docs/CONSTITUTION.md`.
- `install.sh` + the `/install` endpoint (live, `text/plain`, byte-identical
  to the repo file). Downloads the CLI *and* the Explorer sidecar; refuses to
  install the heritage `cli-v*` releases; leaves pre-1.0 state on disk alone.
- `.github/workflows/release.yml` — tag-triggered, 4-OS matrix, builds both
  binaries via each app's `build:<target>` script, attaches them with
  `gh release upload`. **Never executed; the first tag is its first run.**
- Website: OpenGraph card, alpha disclaimers on every docs page, interactive
  hero Explorer tabs, real mainnet asset data, the lore.

## Blocked on the owner

1. **`npm whoami` returns E401.** The token is stale. Nothing publishes until
   the owner runs `npm login`.
2. **`keystore-node@1.0.0-canary.3`** — shipping a release that depends on
   someone else's canary. Undecided.
3. **Flatten history?** Optional, but if it happens it must happen **before**
   tagging. Procedure in `docs/PRODUCTION.md`.

## Ship it

```bash
# 1. optional: flatten first (see docs/PRODUCTION.md), then
git tag v1.0.0-alpha.0 && git push origin v1.0.0-alpha.0

# 2. watch the first-ever run of release.yml
gh run watch --repo initlabsai/vibekit

# 3. verify all 8 assets landed (4 platforms x CLI + sidecar)
gh release view v1.0.0-alpha.0 --repo initlabsai/vibekit --json assets

# 4. publish npm (owner must be logged in)
bun run verify:packed && bunx changeset publish --tag alpha

# 5. the install one-liner should now work end to end
curl -fsSL https://getvibekit.ai/install | VIBEKIT_CHANNEL=alpha sh
```

## Do not get caught by

- **Run `bun install` after any `changeset version`.** `bun pm pack` resolves
  `workspace:*` from `bun.lock`; a stale lockfile publishes packages whose
  dependencies point at versions that never existed. `verify:packed` does
  **not** catch this — read a packed tarball's `package.json` directly.
- `packages/explorer/test/recorded/mainnet-graph-corpus.json` re-records
  itself when tests run. Revert it; do not commit the churn.
- The macOS and Windows binaries have never been run. The owner is testing
  them by hand; update the README platform table afterwards.
- `install.ps1` does not exist, so `install.sh`'s Windows hint is a dead link.

## Not part of shipping

`out/` holds the promo video and its cards (gitignored). `out/assemble.sh`
rebuilds it from a screen recording.
