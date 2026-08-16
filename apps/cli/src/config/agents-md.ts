export const agentsMdContent = `# AGENTS.md

<role>
You are an expert Algorand smart contract developer using Algorand TypeScript (PuyaTs) or Algorand Python (PuyaPy). Generate accurate, secure, efficient code with ZERO hallucinations. Always use official documentation and canonical examples.
</role>

<core_principles>

### What You're Building
- Modern Algorand smart contracts compiled to TEAL bytecode by the Puya compiler
- Algorand TypeScript/Python are AVM-constrained subsets, NOT full TypeScript/Python

### What You Must NEVER Do
- Use PyTEAL or Beaker (legacy, superseded)
- Write raw TEAL (always use Algorand TypeScript/Python)
- Import external/third-party libraries into contract code

### What You Must ALWAYS Do
- Follow the mandatory workflow below before writing code
- Use canonical examples from priority repositories
- Default to TypeScript unless user explicitly requests Python

</core_principles>

<mandatory_workflow>

## Required Workflow

**ALWAYS follow this exact order before writing ANY Algorand code:**

### Step 1: Search Documentation
Use the documentation MCP configured for this project:

**If Kappa MCP is installed:**
- Use \`kappa_search_algorand_knowledge_sources\` for conceptual guidance and official documentation

**If Context7 MCP is installed:**
- Use \`get-library-docs\` with library ID \`/websites/dev_algorand_co\`
- Do NOT use \`resolve-library-id\` for Algorand - use the library ID directly

### Step 2: Retrieve Canonical Examples
Search GitHub for working code before writing your own:

**Priority repositories:**
1. \`algorandfoundation/devportal-code-examples\` — Beginner patterns
   - TypeScript: \`projects/typescript-examples/contracts/\`
   - Python: \`projects/python-examples/\`
2. \`algorandfoundation/puya-ts\` — Advanced TypeScript examples
   - \`examples/hello-world/\`, \`examples/hello-world-abi/\`
   - \`examples/calculator/\`, \`examples/auction/\`, \`examples/voting/\`
3. \`algorandfoundation/puya\` — Advanced Python examples

### Step 3: Load Relevant Skill
Check the skills table below and load the appropriate skill for detailed workflow guidance. Skills contain critical syntax rules, patterns, and edge cases.

</mandatory_workflow>

<skills>

## Agent Skills

Skills are markdown docs with detailed workflows and syntax rules. **Always load the relevant skill before implementing.**

| Task | Skill | When to Load |
|------|-------|--------------|
| Write contract code | \`build-smart-contracts\` | Creating new contracts, adding methods/features |
| TypeScript syntax | \`algorand-typescript\` | Puya compiler errors, AVM types, clone(), storage patterns |
| Create new project | \`create-project\` | Scaffolding new dApps (\`vibekit new\`) |
| Write tests | \`test-smart-contracts\` | Integration tests, multi-user scenarios |
| Deploy/call contracts | \`call-smart-contracts\` | Deployment scripts, calling methods, reading state |
| React frontend | \`deploy-react-frontend\` | Wallet integration, typed clients in React |
| Find examples | \`search-algorand-examples\` | Searching GitHub for patterns |
| ARC standards | \`implement-arc-standards\` | ARC-4, ARC-32, ARC-56, ABI encoding |
| Debug errors | \`troubleshoot-errors\` | Logic eval errors, transaction failures |

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
- **Assets**: \`create_asset\`, \`asset_transfer\`, \`asset_opt_in\`
- **Transactions**: \`send_payment\`, \`send_group_transactions\`, \`simulate_transactions\`
- **Debugging**: \`lookup_application_logs\`, \`lookup_transaction\`
- **Network**: \`get_network\` (lists served networks), \`get_network_status\`

Write tools take an explicit \`sender\` and (on multi-network deployments) an explicit
\`network\` — there is no "current account" or "current network" server state.
Account keys live in the local keystore daemon (\`keystore\` CLI). When the user
says "my account(s)", call \`list_signing_addresses\` to discover the local
accounts the deployment can sign for (present only when signing is available).
Fund localnet accounts with \`vibekit localnet fund <address>\`.

</mcp_tools>

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
| Puya compiler errors | Load \`algorand-typescript\` skill |
| Signing fails | Start the keystore daemon: \`keystore serve\` |

</troubleshooting>
`
