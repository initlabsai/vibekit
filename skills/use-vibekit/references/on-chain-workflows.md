# On-chain workflows

Use this guide for contract deployment and calls, funding, payments, assets,
chain reads, and transaction debugging. Apply the network and approval rules
from `SKILL.md` to every write.

## Build and deploy a contract

1. Read `package.json` and run the project's build script, normally
   `npm run build`. In VibeKit starters this invokes PuyaTs and the typed-client
   generator directly.
2. Locate the generated ARC-56 file under the project's artifacts directory.
3. Call `app_deploy` through MCP with `appSpecPath`, an explicit `sender`, and
   an explicit `network`.

Prefer `appSpecPath` for `app_deploy`, `app_call`, `app_list_methods`, and state
decoding tools. Do not paste a large application spec into model context when
the file exists.

Starter repositories include deployment scripts with mnemonic-based
environment variables for humans and CI systems. Agents use VibeKit's MCP
tools and keystore instead; never search for or populate those secrets.

## Fund an account

- **LocalNet:** run `vibekit localnet fund ADDRESS`.
- **TestNet:** prefer `fund_testnet_account` when available. If the tool is
  absent, the user may need to run `vibekit dispenser login` and restart the
  agent session.
- **TestNet fallback:** check local signing-address balances first. If one
  account already has TestNet ALGO, use `send_payment` to fund the other
  account rather than seeking another faucet grant.
- **MainNet:** acquiring funds is outside VibeKit; never imply otherwise.

## Common tasks

| Task                      | Tool or command                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------- |
| List signing accounts     | `list_signing_addresses`                                                            |
| Balance and holdings      | `lookup_account`, `get_account_portfolio`, `get_account_assets`                     |
| Send ALGO                 | `send_payment` through MCP                                                          |
| Create or transfer an ASA | `asset_create`, `asset_transfer`, `asset_opt_in`                                    |
| Deploy or call a contract | `app_deploy`, `app_call`, `app_get_info`, `app_list_methods`                        |
| Read contract state       | `read_global_state`, `read_local_state`, `list_application_boxes`, `read_box_state` |
| Debug a transaction       | `lookup_transaction`, `lookup_application_logs`, `simulate_transactions`            |
| Resolve an NFD            | `resolve_nfd`, `reverse_resolve_nfd`                                                |
| Inspect network health    | `get_network_status`, `get_network`                                                 |

For the latest block and its transactions, call `lookup_block` without a round,
then use its exact round in `search_transactions` as both `minRound` and
`maxRound`. Add `txType` when the task concerns only payments, asset transfers,
or application calls.

Transaction-search filters compose. Use the narrowest useful combination of
`txType`, IDs, round bounds, time bounds, amount bounds, and `notePrefix`.
