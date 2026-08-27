---
name: update-skill
description: Maintain VibeKit's canonical vendored skills and generated CLI copies. Use when adding, reviewing, refreshing, or removing content under skills/, updating source links or upstream pins, or changing shipped behavior that affects skill guidance. Excludes arbitrary third-party skills outside this repository.
---

# Update a VibeKit skill

Treat `skills/` as product code. Keep each skill aligned with shipped behavior,
current primary sources, and the CLI bundle that installs it into projects.

## Start from current state

Before editing:

1. Read the repository `AGENTS.md`, the affected skill, and only its relevant
   references.
2. Inspect `git status` and preserve unrelated or user-authored changes.
3. Read the implementation and tests for any product behavior the skill
   describes. Read `docs/CONSTITUTION.md` before a structural change.
4. Load an available `skill-creator` skill for current format and authoring
   guidance.

Do not document a plan, pending API, or intended release as current behavior.
If implementation and guidance disagree, determine which is wrong before
editing either surface.

## Choose the source map

| Maintenance task | Reference |
| --- | --- |
| Shape descriptions, routing, progressive disclosure, references, and validation | [Skill design and review](references/skill-design-and-review.md) |
| Refresh AVM, PuyaTs, clients, tests, wallets, ARCs, security, migration, or x402 guidance | [Algorand sources](references/algorand-sources.md) |
| Refresh VibeKit CLI, tool, signing, deployment, plugin, MCP, or starter guidance | [VibeKit sources](references/vibekit-sources.md) |

Load only the source map needed for the change. The affected product skill
remains the authoritative operational guidance; these references record where
to verify it.

## Editing rules

- Keep the entrypoint compact: stable purpose, important boundaries, and a
  task-to-reference router. Move conditional detail into focused references.
- Include guidance that changes an agent's decisions. Remove generic advice,
  copied manuals, stale compatibility paths, and duplicated API catalogs.
- Prefer direct canonical documentation and GitHub source examples. Verify the
  exact branch and path before linking.
- Keep `build-on-algorand` TypeScript-only. Exclude Python and AlgoKit CLI
  workflows, and delegate lifecycle, LocalNet, accounts, signing, deployment,
  and VibeKit operations to `use-vibekit`.
- Preserve upstream license text and a reviewed commit SHA when retained
  material requires attribution.
- Keep x402 and other fast-moving integrations short and link-driven.
- Do not add eval artifacts unless the user asks for them. Add tests for
  repository behavior or meaningful skill invariants, not prose snapshots.

Remote catalogs are a separate distribution tier. Review new upstream content
before changing a catalog, pin a commit SHA rather than a branch, and update
the pin and exported skill list together.

## Synchronize product surfaces

Edit canonical files under `skills/`; never hand-edit
`apps/cli/src/skills/bundled.ts`.

Update the affected surfaces when their meaning changes:

- `skills/README.md` for the canonical inventory;
- `.agents/skills`, `.claude/skills`, and `.grok/skills` discovery symlinks when
  adding or removing a canonical skill;
- `apps/cli/src/config/agents-md.ts` for generated project routing;
- root `README.md` for public scope;
- `docs/CONSTITUTION.md` for durable rationale or governance decisions;
- CLI tests when selection, generation, validation, or catalogs change.

Regenerate the checked-in bundle:

```bash
bun run --cwd apps/cli bundle-skills
```

Then validate in proportion to the change. For changes to the canonical bundle,
run at least:

```bash
bun run --cwd apps/cli typecheck
bun run --cwd apps/cli test
bunx turbo run build typecheck test
git diff --check
```

Use the validator supplied by `skill-creator` when its runtime dependencies are
available. The repository's strict-YAML bundle check remains required. Check
new or changed external links directly.

Review the final diff for accidental generated-file drift, overwritten user
changes, missing attribution, stale counts, and undocumented exclusions. Do
not commit or push unless the user requests it, and inform them before doing
so.
