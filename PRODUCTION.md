# Production notes

Decisions and open items for shipping VibeKit. The release procedure itself
lives in `AGENTS.md`; this file is what is deferred, undecided, or easy to get
wrong once.

## Flattening history before the first tag

The 1.0 line is a rewrite of the v1 product, so `main` does not need the 232
commits leading up to it (the rewrite began 2026-08-15). To start clean:

```bash
git tag pre-1.0-history main && git push origin pre-1.0-history  # optional escape hatch
git checkout --orphan release
git add -A
git commit -m "feat: VibeKit 1.0.0-alpha.0"
git branch -M main
git push --force origin main
```

An orphan branch produces a true root commit. Squashing leaves the old chain
reachable until it is collected.

- **Flatten before tagging, never after.** A release tag must point at a commit
  that is still on `main`. Tagging first and flattening after orphans the tag
  and leaves the GitHub Release pointing at an unreachable SHA.
- The v1 codebase is not at risk either way. All 15 `cli-v*` tags stay on the
  remote and `cli-v0.1.8` is the old `main` tip. Forks and the 27 stars are
  unaffected by a force-push.
- Vercel redeploys on the force-push.

## Open decisions

- **`keystore-node@1.0.0-canary.3`.** Shipping a release that depends on
  someone else's canary. `docs/DESIGN.md` gate #9; unresolved.
- **macOS code signing.** Binaries are unsigned and unnotarized. A quarantined
  download triggers a full Gatekeeper assessment plus an online notarization
  lookup, which is the likely cause of the slow first launch reported against
  the v1 CLI. Installing through Homebrew or `curl` avoids quarantine
  entirely; notarization needs a paid Apple Developer account. Confirm the
  cause before paying: time a downloaded binary, then
  `xattr -d com.apple.quarantine ./vibekit`, and time it again.
- **Platform confirmation.** `docs/DESIGN.md` records macOS and Windows as
  unconfirmed. Update the README platform table after manual passes.

## Not built yet

- **`install.ps1`.** `install.sh` tells Windows users to run
  `irm https://getvibekit.ai/install.ps1 | iex`, which is currently a dead
  link. Port it from the v1 repo and serve it from a `/install.ps1` endpoint
  the same way `/install` is served.
- **Homebrew tap.** The formula needs a release URL and a checksum, so it
  follows the first tag. It installs both binaries into one directory, which
  is the layout `resolveExploreEntry` expects.

## Traps

- **`bun install` after `changeset version`.** `bun pm pack` resolves
  `workspace:*` from `bun.lock`. A stale lockfile publishes packages whose
  dependencies point at versions that never existed. This is in the
  `AGENTS.md` release steps for a reason.
- **`verify:packed` cannot catch that.** Its generated consumer pins the
  `@initlabs` dependencies through `overrides`, which masks a wrong internal
  version. Read a packed tarball's `package.json` directly when versions
  change.
- **Prereleases and caret ranges.** `^1.0.0-alpha.0` matches
  `1.0.0-alpha.0`, but `^0.1.0` does not match `0.1.0-alpha.0`. Changesets
  rewrites the peer ranges correctly; hand-editing them does not.
- **The install script must refuse the v1 releases.** GitHub reports
  `cli-v0.1.8` as the latest non-prerelease, so the stable channel checks that
  a tag really is `v<semver>` before installing it.

## Deferred

- **Merging the Explorer into the CLI binary.** Two binaries carry two copies
  of the Bun runtime (~79 MB each) plus every shared dependency: ~250 MB split
  versus roughly 150 MB merged. The unknown is whether OpenTUI's `bun:ffi`
  library resolves from inside a compiled binary. Timebox it after the alpha.
- **`HANDOVER.md` is stale.** It still describes the release as
  `0.1.0-alpha.1`, a version Changesets cannot produce from `0.1.0`.
  `AGENTS.md` now owns the release procedure; delete `HANDOVER.md` once the
  alpha ships.
- **`vibekit --help` links to the GitHub repository** rather than
  `getvibekit.ai` (`apps/cli/src/index.ts`).
- **`docs/reference/installation.md` documents running from source.** Correct
  until the first release exists; switch it to the install one-liner after
  publishing.
