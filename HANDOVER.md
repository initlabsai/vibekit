# Handover: ship the `v0.1.0-alpha.1` release

For an agent with fresh context. Read `AGENTS.md`, then this. Everything below
was verified on 2026-08-24 unless marked "decide" or "todo".

## Decisions already made by the owner

- Channels: **npm packages under the `alpha` dist-tag** AND **GitHub Release
  binaries** (CLI + TUI sidecar per platform).
- License: Apache-2.0, `Copyright 2026 Init Labs`. The manifests already
  declare `Apache-2.0`; the root `LICENSE` file does not exist yet — add it.
- The repo `initlabsai/vibekit` is (or will be) public.
- Version string: `0.1.0-alpha.1` (packages are all at `0.1.0`, never published,
  no git tags exist).

## What is already green

- Gate: `bunx turbo run build typecheck test --filter='!@initlabs/vibekit-website'`
  → 42/42 tasks, 618 tests. (`apps/website` is another agent's in-progress
  Astro site and currently fails to build — see "Do not touch".)
- `bun run verify:packed` → ok (packs every public package, builds an
  out-of-workspace consumer).
- CLI compiles: `apps/cli` `build:linux-x64` etc. (`bun build --compile`,
  `bundle-skills` first). `build:all` cross-compiles all four targets locally.
- **TUI sidecar compiles and runs standalone**:
  `cd apps/tui && bun build src/index.tsx --compile --outfile vibekit-tui`
  (146 MB, bun runtime included). Ran from a starter project: live localnet,
  keystore account, spec scan, Apps cards — all fine. `vibekit explore` finds a
  file named `vibekit-tui` (or `vibekit-explore`) next to the CLI binary, or
  `VIBEKIT_EXPLORE=<path>` overrides (`apps/cli/src/commands/explore.ts`).
  Caveat: OpenTUI ships a native lib per platform (`@opentui/core-<platform>`,
  optionalDependencies), so **each platform's sidecar must be built on that
  platform** — a 4-OS matrix, not a local cross-compile.

## Publishable set

Public (`private: false`): `@initlabs/vibekit-core`, `-tools`, `-agent`,
`-mcp`, `-signer-keystore`, `-preset`, `-plugin-nfd`, `-plugin-pera`,
`-plugin-vestige`, `-plugin-alpha-arcade`. Private (never publish):
`-explorer` (provisional protocol), `-cli`, `-tui`, `-web`, `-website`.
`.changeset/config.json` fixes `core`/`mcp`/`tools` to one version and ignores
`@initlabs/vibekit-mcp-reference`.

## Steps

1. `LICENSE` at the repo root: Apache-2.0 full text, appendix notice with
   `Copyright 2026 Init Labs`. Commit `chore: add Apache-2.0 license`.
2. Changesets pre-release: `bunx changeset pre enter alpha`, then one changeset
   marking every public package `minor` (they are unpublished; the text can be
   the release notes below), then `bunx changeset version` → `0.1.0-alpha.1`.
   Commit `chore(release): 0.1.0-alpha.1`.
3. npm auth: `npm whoami` returned **E401** on this machine — the owner must
   `npm login` (or provide an `NPM_TOKEN` with publish rights to the
   `@initlabs` scope) before `bunx changeset publish --tag alpha`. Do not
   attempt to publish without it; ask.
4. Release workflow `.github/workflows/release.yml`, triggered on tags `v*`:
   - matrix `ubuntu-latest` / `macos-latest` (arm64) / `macos-13` (x64) /
     `windows-latest`; `oven-sh/setup-bun@v2` (CI pins `1.3.14`; local is
     1.4.0 — pin what CI uses); `bun install --frozen-lockfile`;
     `bunx turbo run build --filter=@initlabs/vibekit-cli^...`;
     `bun run --cwd apps/cli bundle-skills && bun build src/index.ts --compile
     --outfile bin/vibekit-<target>`; `cd apps/tui && bun build src/index.tsx
     --compile --outfile ../cli/bin/vibekit-tui-<target>`; upload both as
     artifacts.
   - a `release` job that downloads the artifacts and attaches them to the
     GitHub Release (`softprops/action-gh-release` or `gh release upload`).
   - an npm job (`ubuntu`) that runs `bunx changeset publish --tag alpha` with
     `NPM_TOKEN` — only if the owner has added the secret; otherwise publish
     locally after `npm login`.
   Smoke each binary in the matrix: `./vibekit --help` and `./vibekit-tui`
   started with a 3s timeout must not crash (the TUI needs a TTY; use
   `script -q` on unix or skip the TUI smoke on windows).
5. Install docs (README "Install"): download `vibekit-<platform>` and
   `vibekit-tui-<platform>` from the release into the same directory, rename
   to `vibekit` / `vibekit-tui`, `chmod +x`, put on PATH. Then
   `vibekit new`, `vibekit localnet start`, `vibekit explore`.
6. Tag `v0.1.0-alpha.1` on the release commit, push tag, let the workflow run,
   verify assets, then publish npm.
7. DESIGN.md: one line under "Current state" that the alpha shipped and what
   the 1.0 gate still owes (rekeyed signing, keystore canary decision,
   cross-platform smoke). Update memory (`explorer-parity-arc`).

## Release notes (draft, since `9239c91`)

- Explorer Apps page (`^2`): one card per contract; deployments detected
  on-chain via the AlgoKit deployer note (which `app_deploy` now stamps);
  creator, state keys, bare actions, live global state.
- Method line: call any ABI method with positional / `name=value` / JSON args
  checked by type; reads simulate inline, writes go through the approval
  modal (decoded args, simulate, keystore signing); `+fund` pays the app
  account's MBR in the same group, `+fee` covers inner-txn fees.
- `d` deploys a spec from its card (template variables on the line).
- Multi-transaction groups now simulate correctly at review.
- Responsive top bar; explain flow no longer duplicates its write-up.
- CLI: `vibekit new` welcome; the CLI and TUI share one wordmark.

## Do not touch

Another agent is building `apps/website` (untracked) and has uncommitted
edits in `README.md`, `docs/DESIGN.md`, `.gitignore`, `package.json`, and
`bun.lock` (its Astro deps). Never `git add -A`; stage explicit paths. If
`bun install --frozen-lockfile` fails in CI because of that lockfile, that's
theirs to land first.

## Gotchas

- `^2` doesn't pass through tmux/vhs; `apps` + Enter opens the same page.
- Keystore daemon must be running for signing (`vibekit keystore status`).
- The starter template's HelloWorld writes a box: the first call needs
  `+fund 0.11` (the modal says so).
