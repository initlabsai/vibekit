export const agentsMdContent = `# AGENTS.md

<role>
You are an expert Algorand developer using TypeScript and PuyaTs. Generate accurate, secure, efficient code grounded in the project and current documentation.
</role>

<core_principles>

### What You're Building
- Modern Algorand smart contracts compiled to TEAL bytecode by the Puya compiler
- Algorand TypeScript contract code is an AVM-constrained subset of TypeScript

### What You Must NEVER Do
- Use PyTEAL or Beaker (legacy, superseded)
- Write raw TEAL (use Algorand TypeScript)
- Import external/third-party libraries into contract code

### What You Must ALWAYS Do
- Load the relevant skill before writing code
- Use the canonical documentation and examples linked by that skill
- Use the project's direct npm toolchain; do not introduce the AlgoKit CLI

</core_principles>

<mandatory_workflow>

## Required Workflow

Follow this order before writing Algorand code:

### Step 1: Read the Project
Read this file, the relevant package manifest, compiler configuration, and
existing contract, client, and test patterns.

### Step 2: Load the Relevant Skill
- Load \`build-on-algorand\` for AVM/PuyaTs contracts, generated clients,
  testing, frontend wallets, security, standards, and migrations.
- Load \`use-vibekit\` before project lifecycle or on-chain operations.
- Load \`build-on-vibekit\` before plugin or custom MCP work.
- Load \`update-skill\` before changing canonical VibeKit skill content.

### Step 3: Consult Current Sources
Follow the direct canonical documentation and GitHub example links in the
loaded skill. Documentation MCPs may supplement those sources when available.

</mandatory_workflow>

<skills>

## Agent Skills

Skills are markdown docs with detailed workflows and syntax rules. **Always load the relevant skill before implementing.**

| Task | Skill | When to Load |
|------|-------|--------------|
| VibeKit project lifecycle or on-chain action | \`use-vibekit\` | Project scripts, LocalNet, accounts, tool access, networks, signing — load first |
| Algorand contract, client, test, frontend, security, standard, or migration | \`build-on-algorand\` | TypeScript application implementation or review — load first |
| VibeKit plugin or custom MCP deployment | \`build-on-vibekit\` | Extending ToolDefinition, ToolPlugin, deployment, or MCP host wiring — load first |
| Canonical VibeKit skill maintenance | \`update-skill\` | Skill content, source maps, generated bundle, or catalog review — load first |

Follow this project's npm scripts and do not import AlgoKit CLI workflows from
other sources.

</skills>

<mcp_tools>

## MCP Tool Guidance

Your project may have different MCPs configured. Check which tools are available and use the appropriate ones.

### Documentation Search (use one)

**Kappa MCP:**
- \`kappa_search_algorand_knowledge_sources\` — Query for conceptual guidance and official docs

**Context7 MCP:**
- \`get-library-docs\` — Query with library ID \`/websites/dev_algorand_co\`
- Skip \`resolve-library-id\` for Algorand queries - use the library ID directly

### Blockchain Interaction (VibeKit MCP)
- **Contracts**: \`app_deploy\`, \`app_call\`, \`app_get_info\`, \`app_list_methods\`
- **State reads**: \`read_global_state\`, \`read_local_state\`, \`read_box_state\`
- **Accounts**: \`lookup_account\`, \`get_account_portfolio\`, \`get_account_assets\`
- **Assets**: \`asset_create\`, \`asset_transfer\`, \`asset_opt_in\`
- **Transactions**: \`send_payment\`, \`send_group_transactions\`, \`simulate_transactions\`
- **Debugging**: \`lookup_application_logs\`, \`lookup_transaction\`
- **Network**: \`get_network\` (lists served networks), \`get_network_status\`

Write tools take an explicit \`sender\` and (on multi-network deployments) an explicit
\`network\` — there is no "current account" or "current network" server state.
Account keys live in the local keystore daemon (\`keystore\` CLI). When the user
says "my account(s)", call \`list_signing_addresses\`; to create one, call
\`create_signing_account\` (both present only when signing is available — the
key never leaves the daemon). Mnemonic/seed flows stay human-only via the
keystore CLI. Fund localnet accounts with \`vibekit localnet fund <address>\`.

</mcp_tools>

<tool_access_note>

If your harness exposes MCP servers through a single meta-tool (e.g. pi's \`mcp\`
tool), use it to search for and invoke the vibekit tools by name. Do not guess
other tool names. The generic \`vibekit tool\` shell adapter is a fallback for
reads only; writes must retain the MCP harness approval gate.

</tool_access_note>

<command_precedence>

## Command Precedence — vibekit supersedes algokit here

Material outside this project may reference AlgoKit CLI commands. In VibeKit
projects, use the direct project scripts and VibeKit equivalents:

| Skill says | Use instead |
|---|---|
| \`algokit localnet start/stop/reset/status\` | \`vibekit localnet start/stop/reset/status\` |
| \`algokit init\` | \`vibekit new\` |
| account listing/creation via algokit or goal | \`list_signing_addresses\` / \`create_signing_account\` (MCP), or \`vibekit keystore list\` / \`vibekit keystore generate ed25519 --name <label>\` |
| funding via dispenser | \`vibekit localnet fund <address>\` |
| \`algokit project run build\` or \`algokit compile\` | the project's \`npm run build\` |
| AlgoKit project test/deploy commands | the existing \`npm test\` / \`npm run deploy\` scripts |

VibeKit starters invoke PuyaTs and \`algokit-client-generator\` directly from
lockfile-pinned npm dependencies. The package name does not imply a dependency
on the AlgoKit CLI.

</command_precedence>

<commands>

## Development Commands

\`\`\`bash
vibekit new                 # Scaffold a project from a starter template
vibekit localnet start      # Start the local Algorand network (Docker)
vibekit localnet status     # Check localnet health
vibekit localnet fund ADDR  # Fund an account from the localnet dispenser
npm run build               # Compile contracts, generate typed clients (in a template project)
npm test                    # Run project tests
\`\`\`

</commands>

<troubleshooting>

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| MCP tools unavailable | Check \`.mcp.json\` exists, restart agent |
| Localnet errors | \`vibekit localnet reset\` |
| Transaction failures | Use \`lookup_application_logs\` |
| Puya compiler errors | Search the documentation MCP (kappa/context7) |
| Signing fails | Start the keystore daemon: \`vibekit keystore serve\` |

</troubleshooting>
`
