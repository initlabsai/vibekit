# Production notes

Working notes for shipping. Short, dated, deletable — resolve an item by
removing it. Rationale lives in `CONSTITUTION.md`; the release procedure lives
in `AGENTS.md`.

## Flattening history before the first tag

The 1.0 line is a rewrite, so `main` does not need the commits leading up to
it. To start clean:

```bash
git tag pre-1.0-history main && git push origin pre-1.0-history  # keeps the old tree reachable
git checkout --orphan release
git add -A
git commit -m "feat: VibeKit 1.0.0-alpha.0"
git branch -M main
git push --force origin main
```

- **Flatten before tagging, never after.** A release tag must point at a commit
  still on `main`; flattening afterwards orphans the tag and leaves the GitHub
  Release pointing at an unreachable SHA.
- The v1 codebase is safe either way: the `cli-v*` tags stay on the remote and
  `cli-v0.1.8` is the old `main` tip. Forks and stars survive a force-push.
- `pre-1.0-history` is also what preserves deleted documents. Anything removed
  from the tree, including the old `DESIGN.md`, is only recoverable through a
  ref that still points at it.
- Vercel redeploys on the force-push.

## Open decisions

- **`keystore-node@1.0.0-canary.3`.** Shipping a release that depends on
  someone else's canary.
- **macOS code signing.** Binaries are unsigned and unnotarized, so a
  quarantined download triggers a full Gatekeeper assessment plus an online
  notarization lookup. Homebrew and `curl` installs avoid quarantine entirely;
  notarization needs a paid Apple Developer account. Confirm the cause before
  paying: time a downloaded binary, run
  `xattr -d com.apple.quarantine ./vibekit`, and time it again.
- **Platform confirmation.** macOS and Windows are unverified. Update the
  README platform table after manual passes.
- **Rekeyed account signing.**
- **Box references on readonly simulate.** Decided for writes: the compose
  engine probe-simulates with `allowUnnamedResources` and attaches what it
  reports (verified 2026-08-23). The TUI's readonly path for methods that read
  boxes is still open.

## Not built yet

- **`install.ps1`.** `install.sh` points Windows users at
  `irm https://getvibekit.ai/install.ps1 | iex`, currently a dead link. Port it
  from the v1 repo and serve it from a `/install.ps1` endpoint the way
  `/install` is served.
- **Homebrew tap.** Needs a release URL and checksum, so it follows the first
  tag. It installs both binaries into one directory, which is the layout
  `resolveExploreEntry` expects.

## Traps

- **`bun install` after `changeset version`.** `bun pm pack` resolves
  `workspace:*` from `bun.lock`. A stale lockfile publishes packages whose
  dependencies point at versions that never existed.
- **`verify:packed` cannot catch that.** Its generated consumer pins the
  `@initlabs` dependencies through `overrides`, which masks a wrong internal
  version. Read a packed tarball's `package.json` directly when versions
  change.
- **Prereleases and caret ranges.** `^1.0.0-alpha.0` matches `1.0.0-alpha.0`,
  but `^0.1.0` does not match `0.1.0-alpha.0`. Changesets rewrites peer ranges
  correctly; hand-editing them does not.
- **The install script must refuse the v1 releases.** GitHub reports
  `cli-v0.1.8` as the latest non-prerelease, so the stable channel checks that
  a tag is really `v<semver>` before installing it.

## Deferred

- **Merging the Explorer into the CLI binary.** Two binaries carry two copies
  of the Bun runtime (~79 MB each) plus every shared dependency: ~250 MB split
  versus roughly 150 MB merged. The unknown is whether OpenTUI's `bun:ffi`
  library resolves from inside a compiled binary.
- **`vibekit --help` links to the GitHub repository** rather than
  `getvibekit.ai` (`apps/cli/src/index.ts`).
- **`docs/reference/installation.md` documents running from source.** Correct
  until a release exists; switch it to the install one-liner after publishing.
- **`vibekit --version` should make drift obvious** — a commit hash or build
  date, not just the version.

## Notes

### 2026-08-23 — npm publishing and the MCP command path

`vibekit init` writes an absolute command into agent MCP configs, resolved by
`resolveVibekitPath` (`apps/cli/src/commands/init.ts`): a compiled binary
writes its own `execPath`; a `vibekit`-named script writes its `argv[1]`; and
running from source falls back to `apps/cli/scripts/vibekit-dev`, a tracked
shim that runs the tree.

The fallback is dev-only by construction, and `apps/cli` is `private: true`
with no `bin` field, so there is no npm execution path today. If the CLI is
ever published to npm:

- add a `bin` entry whose file is named `vibekit` (or `vibekit.js`) — node and
  bun set `argv[1]` to that file's real path, so the second branch fires and
  the absolute path written is the installed one;
- better: for npm installs write plain `vibekit` (resolved on PATH) instead of
  an absolute path, so the config survives reinstalls and version bumps. Key it
  off the `bin` field's presence; do not add it before then.
