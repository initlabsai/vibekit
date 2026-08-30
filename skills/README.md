# VibeKit Agent Skills

The canonical skill set bundled into `vibekit init` (via
`apps/cli/scripts/bundle-skills.ts`, which reads this directory at build time).

This top-level `skills/` directory is the tool-agnostic source of truth. Git
tracks relative discovery symlinks for local agents:

- `.agents/skills` for Codex;
- `.claude/skills` for Claude Code;
- `.grok/skills` for Grok Build.

Do not duplicate canonical skill content in those agent-specific directories.

The current set has four product skills and one maintenance skill:

- `use-vibekit` — operating inside a VibeKit-configured project: CLI and MCP
  access, project lifecycle, LocalNet, accounts, signing, and on-chain flows.
- `build-on-algorand` — building TypeScript applications with AVM/PuyaTs
  contracts, generated clients, tests, frontend wallets, and Algorand
  standards.
- `audit-algorand` — performing structured security audits, threat models,
  exploit analysis, mainnet-readiness reviews, and finding reports for PuyaTs
  applications and LogicSigs.
- `build-on-vibekit` — extending VibeKit through its public tool, plugin,
  deployment, and host surfaces.
- `update-skill` — maintaining canonical skill content, source provenance,
  generated CLI copies, and validation.

One internal skill (`internal: true` in frontmatter — discoverable by local
agents through the symlinks, skipped by `bundle-skills`, never shipped):

- `marketing-content` — every public-facing asset: social copy in the vibekit
  and qt314 voices, promo videos of the TUI (VHS + ffmpeg), title cards, OG
  and quote images, lore dossier cards, qt314 animations, and the brand
  palette, type, and card grammar.

Skills follow the [Agent Skills](https://agentskills.io) format: one directory
per skill with a `SKILL.md` (frontmatter: `name`, `description`) plus optional
`references/`, `scripts/`, and `assets/`.
