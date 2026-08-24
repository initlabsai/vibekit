# Production notes

Working notes for the road to publishing. Short, dated, deletable — resolve an
item by removing it. Architecture lives in DESIGN.md; rationale in
CONSTITUTION.md.

## Open before publish

- Install channel: how `vibekit` reaches PATH (compiled binaries today; see
  the npm note below).
- TUI sidecar packaging for `vibekit explore`.
- Rekey signing resolution.
- License file.
- Keystore canary pin (`1.0.0-canary.3` today) → a release.
- Box references on app calls — undecided; calls that touch boxes may fail
  simulate. Check whether algokit-utils `populateAppCallResources` covers it
  before designing anything.
- First changeset.

## Notes

### 2026-08-23 — npm publishing and the MCP command path

`vibekit init` writes an absolute command into agent MCP configs, resolved by
`resolveVibekitPath` (`apps/cli/src/commands/init.ts`): a compiled binary
writes its own `execPath`; a `vibekit`-named script writes its `argv[1]`; and
running from source falls back to `apps/cli/scripts/vibekit-dev`, a tracked
shim that runs the tree (the previous fallback, `bin/vibekit`, was a compiled
binary that drifted from the source and made agent sessions run stale
servers).

The fallback is dev-only by construction — a compiled binary never reaches
it — and `apps/cli` is `private: true` with no `bin` field, so there is no
npm execution path today. If the CLI is published to npm:

- add a `bin` entry whose file is named `vibekit` (or `vibekit.js`) — node and
  bun set `argv[1]` to that file's real path, so the second branch fires and
  the absolute path written is the installed one;
- better: for npm installs write plain `vibekit` (resolved on PATH) instead
  of an absolute path, so the config survives reinstalls and version bumps.
  Key it off the `bin` field's presence; do not add it before then.

### 2026-08-23 — stale local binaries

`~/.local/bin/vibekit` was an Aug 22 build and silently answered `vibekit new`
with a two-skill picker that no longer exists in the tree. Until the install
channel exists, `vibekit-dev` (→ `apps/cli/scripts/vibekit-dev`) is the only
binary guaranteed to match the source. Whatever the channel becomes, `vibekit
--version` should make drift obvious — a commit hash or build date, not just
`0.1.0`.
