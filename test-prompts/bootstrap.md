# Bootstrap Test Prompt (empty directory → running suite)

The end-to-end onboarding path: an agent with shell access and the `vibekit`
binary goes from an empty directory to a configured project with a connected
MCP server, ready to run the rest of the suite. This exercises the headless
CLI (`--yes`), config generation, and environment provisioning — everything a
new user's agent would do. Follow [README.md](README.md) conventions.

**Prereq:** the compiled `vibekit` binary on PATH (or an explicit path to it),
Docker available, shell access. No project exists yet.

## Tests

### Environment diagnosis

1. Run `vibekit doctor`.
   - Verify: exits successfully and reports on bun/node/docker/keychain. Record any warnings — they predict failures below.

### Headless setup

2. In a fresh empty directory, run `vibekit init . --yes` (no `--agents`).
   - Verify: fails fast with a message requiring `--agents` and listing the valid ids. Exit code non-zero. No files written.
3. Run `vibekit init . --yes --agents claude`.
   - Verify: exit 0, no prompts (run it with stdin closed if your harness allows: `< /dev/null`).
   - Verify files: `.mcp.json`, `AGENTS.md`, `CLAUDE.md`, `.claude/skills/` containing the canonical `use-vibekit` skill and its references.
4. Inspect `.mcp.json`.
   - Verify: the `vibekit` server entry's command is an absolute path to a real on-disk binary — **never** a `/$bunfs/...` virtual path (the compiled-binary regression `vibekit doctor` exists to catch).
   - Verify: env carries `NETWORK=localnet`, `NETWORKS=localnet,testnet,mainnet`, `SIGNING=execute`.
5. Re-run `vibekit init . --yes --agents claude` after appending a marker line to `AGENTS.md`.
   - Verify: exit 0 and your marker survives — headless re-runs must not clobber customizations without `--overwrite`.
6. Run `vibekit doctor` again inside the project.
   - Verify: no issues reported against the just-written config.

### Scaffold path (optional — needs network access to GitHub)

7. In another empty location, run `vibekit new smoke-app -t contracts --yes --agents claude`.
   - Verify: exit 0; template files extracted (package.json, contracts sources) AND the same init artifacts as step 3 — scaffold and agent setup compose.
   - SKIP with reason if offline.

### Provision the chain environment

8. Run `vibekit localnet start`, then `vibekit localnet status`.
   - Verify: containers healthy; algod and indexer reachable.
9. Start `vibekit keystore serve` in the background.
   - Verify: it stays up (give it a few seconds; the first run may provision the pinned keystore-node).

### Connect and hand off

10. Connect (or restart) the MCP server exactly as `.mcp.json` specifies.
    - Verify: the tool list loads; `get_network` reports localnet; `list_signing_addresses` succeeds (proves execute mode + daemon connectivity).
11. Hand off: proceed to [all.md](all.md) (or report READY if this bootstrap run is standalone).

## Report

PASS/FAIL per step, plus: exact file tree created by step 3, the resolved
binary path from step 4, and total wall-clock time from empty directory to
READY — that number is the onboarding cost we are tracking.
