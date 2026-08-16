# VibeKit Agent Skills

The canonical skill set bundled into `vibekit init` (via
`apps/cli/scripts/bundle-skills.ts`, which reads this directory at build time).

- `use-vibekit` and `vibekit-project-setup` are authored here and are the
  canonical guidance for agents working in vibekit projects.
- The language/stack skills (`algorand-typescript`, `algorand-python`,
  `algorand-core`, `algokit-utils-*`, `algorand-frontend`, `algorand-x402-*`,
  `algorand-ecosystem`) were vendored from
  [algorand-devrel/algorand-agent-skills](https://github.com/algorand-devrel/algorand-agent-skills)
  (MIT) and are maintained here going forward.

Skills follow the [Agent Skills](https://agentskills.io) format: one directory
per skill with a `SKILL.md` (frontmatter: `name`, `description`) plus optional
`references/`.
