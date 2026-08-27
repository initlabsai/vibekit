# Production notes

Working notes for shipping. Short, dated, deletable — resolve an item by
removing it. Rationale lives in `CONSTITUTION.md`; the release procedure lives
in `AGENTS.md`.

## Deferred

- **A Node-free keystore.** Signing requires `node` on PATH: the managed
  keystore CLI is a `#!/usr/bin/env node` program, and `npm` provisions it.
  Everything else in the binary works without Node -- chain queries, `new`,
  `init`, the Explorer -- so the toolchain-free install story holds until the
  first signature. Building a scaffolded project needs Node anyway
  (`engines: node >=24`, `puya-ts`, `tsx`, `vitest`), so this is not currently
  blocking anyone; it is a story problem more than a capability one.

  A prototype on 2026-08-27 showed it is removable. `keystore-node` is 244 KB
  of JS plus one optional native addon (`@napi-rs/keyring`, 2.9 MB), and Bun
  embeds NAPI addons in compiled binaries -- verified in isolation, then
  end to end: a compiled binary listed real OS-keychain entries with no `node`
  on PATH. Two upstream packaging details block a naive compile, neither
  fundamental:

  - `isEntryPoint()` in `dist/cli.js` compares `realpathSync(argv[1])` with its
    own module URL, which never matches inside Bun's virtual filesystem, so the
    CLI exits 0 in silence. A shim calling the exported `runCli` avoids it.
  - `createNapiKeyring` (`dist/storage/keyring.js`) loads the addon through
    `createRequire(import.meta.url)` to keep it optional, which no bundler can
    follow. A static import fixes it.

  Fold it into the existing `vibekit` binary rather than shipping a third one:
  the Bun runtime is already there, so the cost is ~3 MB, not another 83 MB.
  That would remove the npm provisioning step, the Node daemon, and the
  `node`/`npm` checks in `doctor`.

  The blocker is that this means patching a `dist/` file of someone else's
  canary on every version bump. Raise it upstream first -- `createNapiKeyring`
  is already built to be swappable for tests, so exposing that injection point
  (or using a static import) would remove the patch entirely.
