# VibeKit sources

Use this map when maintaining `use-vibekit`, `build-on-vibekit`, generated
project guidance, or skill distribution. Local implementation and tests are
the authority for shipped behavior.

## Repository contracts

- `AGENTS.md` — operational rules and required gates
- `docs/CONSTITUTION.md` — the bets the project rests on and how work is judged
- `docs/CONSTITUTION.md` — durable rationale and governance
- `packages/vibekit/src/core/contract.ts` — `ToolDefinition`, `ToolContext`,
  `ToolPlugin`, schemas, and tool flags
- `packages/vibekit/src/core/deployment.ts` — context resolution and
  `executeToolCall`
- `packages/vibekit/src/core/compose/` — write composition and execution
- `packages/vibekit/src/tools/` — canonical tool definitions and exact tool names

Read the public exports and package tests alongside implementation. Do not
teach private imports, alternate handler shapes, or a write path around the
compose engine.

## VibeKit operation

Verify `use-vibekit` against:

- `apps/cli/src/commands/` for `new`, `init`, LocalNet, keystore, dispenser,
  doctor, and generic tool behavior;
- `packages/vibekit/src/signer-keystore/` for daemon signing and account custody;
- `apps/cli/src/config/agents-md.ts` for generated project instructions;
- the project's current `package.json` scripts and generated artifacts;
- MCP tool schemas rather than remembered argument shapes.

The three public starter repositories are:

- [contracts](https://github.com/initlabsai/algorand-starter-contracts)
- [full stack](https://github.com/initlabsai/algorand-starter-fullstack)
- [kitchen sink](https://github.com/initlabsai/algorand-starter-kitchensink)

Use the current starter source to verify direct npm scripts, artifact paths,
client generation, tests, deployment examples, frontend signing, and optional
subscriber behavior. Do not restore AlgoKit CLI or Python instructions from
older templates.

## VibeKit extension development

Verify `build-on-vibekit` against:

- `packages/vibekit/src/mcp/` for the generic MCP adapters;
- `packages/vibekit/examples/` for reference stdio and HTTP deployments;
- `packages/vibekit/src/preset/` for the shared stock tool and plugin mix;
- `packages/vibekit/src/plugins/pera/`, `packages/vibekit/src/plugins/nfd/`, and
  `packages/vibekit/src/plugins/alpha-arcade/` for current plugin patterns;
- package manifests and tests for peer dependencies, output schemas, services,
  network guards, and public exports.

For the protocol boundary, use the official
[MCP 2026-07-28 Streamable HTTP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/transports/streamable-http.mdx)
and [release overview](https://blog.modelcontextprotocol.io/posts/2026-07-28/).
VibeKit's remote guidance targets stateless Streamable HTTP; local clients use
stdio. Re-check the installed MCP package and adapters before updating any
wire-level example.

## Skill delivery

The canonical-to-generated path is:

```text
skills/ -> apps/cli/scripts/bundle-skills.ts
        -> apps/cli/src/skills/bundled.ts
        -> vibekit init / vibekit new
```

The source repository exposes the same canonical tree to local agents through
Git-tracked relative symlinks:

- `.agents/skills -> ../skills` for Codex;
- `.claude/skills -> ../skills` for Claude Code;
- `.grok/skills -> ../skills` for Grok Build.

Keep all three discovery roots as links to the complete canonical tree. Do not
copy canonical content or add agent-specific skills beneath those links.

Verify discovery behavior against the current official documentation for
[Codex](https://developers.openai.com/codex/skills),
[Claude Code](https://code.claude.com/docs/en/skills), and
[Grok Build](https://docs.x.ai/build/features/skills-plugins-marketplaces).
The open Agent Skills standard defines skill contents; each host still defines
its filesystem discovery roots.

Use these files when the distribution surface changes:

- `apps/cli/src/skills/index.ts` — bundled skill selection
- `apps/cli/src/skills/catalogs.ts` — reviewed, SHA-pinned remote catalogs
- `apps/cli/src/utils/tarball.ts` — catalog and starter tarball extraction
- `apps/cli/src/commands/init.ts` — selection and installation
- `apps/cli/src/commands/new.ts` — starter creation followed by initialization
- `apps/cli/test/config.test.ts`, `init.test.ts`, and `catalogs.test.ts` —
  bundle, frontmatter, selection, and pin invariants

Do not copy remote catalogs into `skills/`. Do not point catalog refs at a
branch. Regenerate `bundled.ts` after every canonical skill change and confirm
the generated copy contains current user-authored source changes.
