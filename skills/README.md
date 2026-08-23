# VibeKit Agent Skills

The canonical skill set bundled into `vibekit init` (via
`apps/cli/scripts/bundle-skills.ts`, which reads this directory at build time).

This top-level `skills/` directory is the tool-agnostic source of truth. Git
tracks relative discovery symlinks for local agents:

- `.agents/skills` for Codex;
- `.claude/skills` for Claude Code;
- `.grok/skills` for Grok Build.

Do not duplicate canonical skill content in those agent-specific directories.

The current set has three product skills and one maintenance skill:

- `use-vibekit` — operating inside a VibeKit-configured project: CLI and MCP
  access, project lifecycle, LocalNet, accounts, signing, and on-chain flows.
- `build-on-algorand` — building TypeScript applications with AVM/PuyaTs
  contracts, generated clients, tests, frontend wallets, and Algorand
  standards.
- `build-on-vibekit` — extending VibeKit through its public tool, plugin,
  deployment, and host surfaces.
- `update-skill` — maintaining canonical skill content, source provenance,
  generated CLI copies, and validation.

Skills follow the [Agent Skills](https://agentskills.io) format: one directory
per skill with a `SKILL.md` (frontmatter: `name`, `description`) plus optional
`references/`.
