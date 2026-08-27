export const agentsMdContent = `# AGENTS.md

Algorand project set up by [VibeKit](https://getvibekit.ai). Contracts are
Algorand TypeScript (PuyaTs); clients, tests, and scripts are plain TypeScript
run via npm scripts.

## Workflow

1. Read \`package.json\` and the existing contract, client, and test code first.
2. Load the matching skill before writing code or touching the chain.
3. Look up every unfamiliar PuyaTs API before using it (see below).
4. Finish with the full \`npm test\`. Report what ran and what failed. Red or
   unrun e2e tests mean the change is not done — the failure is almost always
   the change (e.g. an unfunded app account), not the harness.

## Skills

| Skill | Load for |
|-------|----------|
| \`use-vibekit\` | any on-chain action, accounts, LocalNet, signing, deploys |
| \`build-on-algorand\` | contracts, clients, tests, frontend wallet code |
| \`audit-algorand\` | security audits, threat models, mainnet-readiness |
| \`build-on-vibekit\` | VibeKit tools, plugins, custom MCP deployments |
| \`update-skill\` | editing these skills in the VibeKit repo |

Some may be absent or supplemented by third-party skills — check what is installed.

## Tools

- **vibekit** (MCP): on-chain reads and writes. Use its registered tool names
  and descriptions; never guess them.
- **kapa** (MCP; some projects use **context7**): official Algorand docs.
  Use it before web search for concepts, costs, and protocol rules.

## Never write PuyaTs from memory

PuyaTs is a constrained dialect. Before any API call not already used in this
project, and on every compile error, consult in order:

1. \`node_modules/@algorandfoundation/algorand-typescript/*.d.ts\` — exact for
   the pinned version; a compile error names the type to read.
2. The skill's linked example for that feature.
3. The kapa (or context7) MCP.

Do not edit again until one of these has answered.

## Sender and network are always explicit

The vibekit server is stateless: no current account, no current network. Every
write takes \`sender\` and \`network\`.

- No account named → call \`list_signing_addresses\` and ask which to use.
- No network named → ask.
- Never infer either from context.
- TestNet/MainNet writes: state network, sender, and action; get explicit
  approval each time. Approval never carries over.

## Rules

- Algorand TypeScript only. No PyTEAL, Beaker, hand-written TEAL, or
  third-party imports in contract code.
- Never use the AlgoKit CLI. Translate: \`algokit localnet ...\` →
  \`vibekit localnet ...\`; \`algokit compile\` / \`algokit project run build\` →
  \`npm run build\`.

## Commands

\`\`\`bash
vibekit localnet start      # local Algorand network (Docker)
vibekit localnet fund ADDR  # fund from the dispenser
npm run build               # compile contracts, generate typed clients
npm test
vibekit doctor              # check CLI, MCP, Docker, keystore
\`\`\`
`
