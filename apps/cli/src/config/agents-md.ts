export const agentsMdContent = `# AGENTS.md

You are working in an Algorand project set up by [VibeKit](https://getvibekit.ai). Contracts are
Algorand TypeScript (PuyaTs) compiled by the Puya compiler; clients, tests,
and scripts are ordinary TypeScript run through this project's npm scripts.

## Workflow

1. Read this file, \`package.json\`, and the existing contract, client, and
   test code before changing anything.
2. Load the relevant skill (below) before writing code or touching the chain.
3. Research before writing contract code: follow the skill's canonical
   documentation and example links, and search the documentation MCP.

## Skills

Skills are markdown guides installed by VibeKit. This project may have some or
all of these, plus others from third-party catalogs — check what is installed.

| Skill | Load when |
|-------|-----------|
| \`use-vibekit\` | any on-chain action, account, LocalNet, signing, or deploy work |
| \`build-on-algorand\` | writing or reviewing contracts, clients, tests, or frontend wallet code |
| \`audit-algorand\` | a security audit, threat model, or mainnet-readiness review |
| \`build-on-vibekit\` | writing VibeKit tools, plugins, or custom MCP deployments |
| \`update-skill\` | editing these skills in the VibeKit repo |

## Tools

- **vibekit** (MCP) — on-chain reads and writes. Use the tools it registers
  and read their descriptions instead of guessing names.
- **kappa** or **context7** (MCP) — Algorand documentation search.

## CRITICAL: sender and network

The vibekit server keeps no state — there is no current account and no current
network. **You** are the state, so every write takes an explicit \`sender\` and
\`network\`:

- If the user has not named an account, call \`list_signing_addresses\` and
  **ask which one to use**. Never pick a sender on their behalf.
- If the user has not named a network, **ask**. Never assume from context.
- Before any TestNet or MainNet write, state the network, sender, and action
  and get explicit approval. Approval for one action does not carry to the next.

## Rules

- Algorand TypeScript only. No PyTEAL, Beaker, or hand-written TEAL, and no
  third-party imports inside contract code.
- Use this project's npm scripts. Never introduce the AlgoKit CLI: where a
  source says \`algokit localnet ...\`, use \`vibekit localnet ...\`; where it says
  \`algokit compile\` or \`algokit project run build\`, use \`npm run build\`.

## Commands

\`\`\`bash
vibekit localnet start      # local Algorand network (Docker)
vibekit localnet fund ADDR  # fund an account from the dispenser
npm run build               # compile contracts, generate typed clients
npm test
vibekit doctor              # diagnose CLI, MCP, Docker, and keystore setup
\`\`\`
`;
