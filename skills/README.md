# VibeKit Agent Skills

The canonical skill set bundled into `vibekit init` (via
`apps/cli/scripts/bundle-skills.ts`, which reads this directory at build time
and refuses frontmatter that isn't strict YAML).

Current set — deliberately small and fully vibekit-consistent:

- `use-vibekit` — how agents interact with Algorand through VibeKit (tool
  access paths, accounts/keystore, networks, signing, denominations).
- `vibekit-project-setup` — scaffolding, agent setup, localnet lifecycle,
  doctor.

Language/stack skills (contract syntax, client code, frontend) were vendored
from [algorand-devrel/algorand-agent-skills](https://github.com/algorand-devrel/algorand-agent-skills)
(MIT) and **removed 2026-08-16** pending a vibekit-consistent refactor: their
content is tightly coupled to AlgoKit CLI workflows and was observed steering
agents (especially small local models) into algokit commands that vibekit
supersedes. They live in git history (`git log -- skills/`) and return
individually as each is refactored.

Skills follow the [Agent Skills](https://agentskills.io) format: one directory
per skill with a `SKILL.md` (frontmatter: `name`, `description`) plus optional
`references/`.
