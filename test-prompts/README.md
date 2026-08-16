# VibeKit v2 MCP Test Prompts

Agent-executed acceptance tests for the VibeKit tool surface (~52 tools). Each
file is a self-contained prompt: paste it (or dispatch it to a sub-agent) in a
session that has the VibeKit MCP server connected. The agent runs the numbered
steps via MCP tool calls and reports PASS/FAIL.

These exercise the **live path** — MCP host → adapter → `executeToolCall` →
real chain — which unit tests cannot: output-schema enforcement against real
indexer shapes, write gating, compose-vs-execute, keystore signing.

## Setup (localnet files)

```bash
vibekit localnet start          # Docker localnet (algod :4001, indexer :8980)
vibekit keystore serve &        # keystore daemon (signing)
```

Connect the MCP server with the standard init env (multi-network, execute
mode): `NETWORK=localnet`, `NETWORKS=localnet,testnet,mainnet`,
`SIGNING=execute` — e.g. the `.mcp.json` written by `vibekit init`, or
`vibekit mcp` on stdio. Several tests assume a multi-network deployment (the
injected `network` parameter must exist and be **required** on write tools).

Funding is a CLI step, not a tool: `vibekit localnet fund <ADDRESS>`.
Prompts that need funded accounts say so at the top; run the CLI command when
the prompt instructs it (or pre-fund and substitute addresses).

## Run order

| File | Network | Needs |
|---|---|---|
| [network.md](network.md) | localnet | localnet |
| [keystore.md](keystore.md) | localnet | + keystore daemon |
| [transactions.md](transactions.md) | localnet | + 2 funded signing accounts |
| [assets.md](assets.md) | localnet | + 2 funded signing accounts |
| [contracts.md](contracts.md) | localnet | + 1 funded signing account |
| [accounts.md](accounts.md) | localnet | run after transactions/assets (needs history) |
| [gates.md](gates.md) | localnet | + 1 funded signing account (nothing is spent) |
| [plugins.md](plugins.md) | mainnet | internet (read-only, no funds) |
| [testnet-dispenser.md](testnet-dispenser.md) | testnet | `vibekit dispenser login` |

`all.md` sequences the localnet files into one run.

## Reporting conventions (apply to every file)

- Report one PASS/FAIL line per numbered test, then a summary table
  (`total / passed / failed / skipped`).
- On FAIL: include the tool name, the exact arguments sent, and the **raw
  error text**. Do not retry silently; do not "fix" arguments beyond what the
  step says — a step that only works with unrequested arguments is a FAIL.
- On unexpected-but-passing behavior (wrong field name, odd formatting,
  misleading description), report a WARN with details. Tool descriptions that
  misled you into a wrong first call are WARNs — that is UX signal.

## Blanket assertions (always in force, every file)

- **No `OUTPUT_MISMATCH` ever.** Any occurrence is a schema bug — report it
  as FAIL with the full message even if the step otherwise "worked".
- Expected-refusal tests must fail with the **stated error code** in the
  message (e.g. `CLOSE_NOT_CONFIRMED`) — a generic error or a success is FAIL.
- Every write tool call must include an explicit `"network"` argument.
  Steps deliberately omitting it (gates.md) expect refusal.
- Amounts: `send_payment` takes `amountMicroAlgos` (µALGO); lookups report
  `fee`/`paymentAmount` in **ALGO**. Verify conversions accordingly.
- Never use mainnet in any write call. Localnet files must never name
  `testnet`/`mainnet` except where a step explicitly tests refusal.
