---
name: use-vibekit
description: How to interact with Algorand through VibeKit as an AI agent — tool access paths (MCP, meta-tool harnesses, shell fallback), the account/keystore model, network selection, signing modes, and common on-chain flows. Load this before any on-chain action in a vibekit-configured project.
---

# Use VibeKit

VibeKit gives you ~50 tools for Algorand: accounts, assets, transactions,
applications, blocks, NFD names, and prediction markets. One engine, several
access paths — pick whichever your harness supports.

## Tool access paths (in order of preference)

1. **Native MCP tools** (Claude Code, Cursor, Copilot, Codex, OpenCode): the
   vibekit server from `.mcp.json` registers every tool directly. Just call
   them: `lookup_account`, `send_payment`, `app_deploy`, …
2. **Meta-tool harnesses** (pi with pi-mcp-adapter): MCP tools are reached
   through a single `mcp` tool — search for the tool name, then invoke it.
   Do not guess other tool names.
3. **Shell fallback — READS ONLY** (any harness with shell access, no MCP):

   ```bash
   vibekit tool list                                        # browse all tools
   vibekit tool lookup_account --help                       # parameter schema
   vibekit tool lookup_account '{"address":"...","network":"mainnet"}'
   ```

   Arguments are one JSON object string; results are JSON on stdout. This is
   the correct fallback when MCP is unavailable — never invent other CLI
   commands for on-chain actions. **Writes (send/create/deploy/fund) must go
   through MCP tools**, where your harness's approval gate applies —
   `vibekit tool` executes writes without any gate and is reserved for the
   human at the keyboard and their scripts. If you have shell but no MCP
   write path, compose the request and hand the exact command to the user.

## Accounts: no "current account" exists

- Keys live in the OS keychain behind the **keystore daemon**
  (`vibekit keystore serve` — vibekit provisions and pins the daemon itself;
  nothing is installed globally). The server never holds key material.
- **"my accounts" → call `list_signing_addresses`** (present when signing is
  available). Returns addresses with their labels; pass
  `{"includeBalances": true}` to add ALGO balances. Shell equivalent:
  `vibekit tool list_signing_addresses '{"includeBalances":true}'`.
- **"create an account" → call `create_signing_account`** (optional `name`).
  The key is generated inside the daemon, stays unextractable in the OS
  keychain, and only the address comes back. It is a gated (approval-carrying)
  action: it mints key material on the user's machine.
  Shell equivalent: `vibekit tool create_signing_account '{"name":"..."}'`.
- Every write tool takes an explicit `sender`. There is no switch-account
  concept; remember the user's chosen address in conversation and pass it
  explicitly each time.
- **Human-only**: mnemonic/seed-phrase flows (`vibekit keystore generate seed`,
  HD derivation, imports/exports of secrets) — those print or accept key
  material, which must never pass through you.
- Caveat: keys created with the raw CLI (`vibekit keystore generate ed25519`)
  while the daemon is running are not visible to tools until the daemon
  restarts. Prefer `create_signing_account`, which goes through the daemon.

## Networks: explicit, never invented

Deployments serve a fixed set (usually localnet, testnet, mainnet) with a
default. Tools accept a `network` parameter — optional on reads (defaults),
**required on writes** so nothing spends on a silently-defaulted chain. Use
`get_network` to see what is served; never invent endpoints.

## Signing modes

- **execute** (keystore daemon running): write tools sign and submit, returning
  txIds and confirmation. Your harness's own approval gate is the safety layer.
- **compose** (no daemon): write tools return `{ unsignedGroup: [...base64...] }`
  for external signing. If the user expects execution, tell them to run
  `keystore serve` and restart the MCP server.

## Denominations

ALGO amounts in tool *results* (fees, payment amounts, balances) are already in
ALGO — report them as-is, never re-divide by 1e6. Tool *inputs* named
`amountMicroAlgos` are microALGO (1 ALGO = 1,000,000 microALGO). ASA amounts
are in base units unless a decimals field says otherwise.

## Funding accounts

- **Localnet**: agent-complete — shell: `vibekit localnet fund <address>` (kmd dispenser, no auth).
- **Testnet, preferred**: if the `fund_testnet_account` tool is present, use it
  (Foundation dispenser; daily limits; refreshes its own session). If it is
  absent, the one-time human grant is missing — tell the user to run
  `vibekit dispenser login` and restart the agent session.
- **Testnet, fallback (no dispenser session)**: the **treasury pattern** — the
  user funds a single account once at https://lora.algokit.io/testnet/fund,
  then use `send_payment` from it to bootstrap any other account. Check
  existing balances first (`list_signing_addresses` with `includeBalances`):
  if ANY local account already holds testnet ALGO, redistribute instead of
  seeking a faucet. Never hunt for unauthenticated public faucets; they no
  longer exist.
- **Mainnet**: real funds — acquiring them is entirely the user's business.

## Common flows

| Task | Tools |
|---|---|
| Who am I / my accounts | `list_signing_addresses` |
| Balance & holdings | `lookup_account`, `get_account_portfolio`, `get_account_assets` |
| Send ALGO | `send_payment` via MCP (sender, receiver, amountMicroAlgos, network) — never via shell |
| Fund a localnet account | shell: `vibekit localnet fund <address>` |
| Create / transfer ASAs | `create_asset`, `asset_transfer`, `asset_opt_in` |
| Deploy / call contracts | `app_deploy`, `app_call`, `app_get_info`, `app_list_methods` |
| Read contract state | `read_global_state`, `read_local_state`, `read_box_state` |
| Debug a transaction | `lookup_transaction`, `lookup_application_logs`, `simulate_transactions` |
| Resolve names | `resolve_nfd`, `reverse_resolve_nfd` |
| Network health | `get_network_status` (current round, TPS), `get_network` |

## Reporting results

Never re-type addresses, transaction ids, or asset ids — copy them exactly
from tool output, or point at the output block. A single transcribed
character corrupts them (addresses are checksummed and will fail validation).
Rendered tool output the user can already see does not need restating;
summarize what it means instead.

## Troubleshooting

- MCP tools missing → `vibekit doctor` (add `--fix` to repair configs).
- Signing fails / write tools absent → `vibekit keystore serve`, then restart the server.
- Localnet errors → `vibekit localnet status`, `vibekit localnet reset`.
- This project may also contain AlgoKit-era docs; for localnet, scaffolding,
  accounts, and funding, vibekit commands supersede algokit ones. Compilation
  and typed-client generation remain AlgoKit's (`algokit project run build`).
