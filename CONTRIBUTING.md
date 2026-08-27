# Contributing

Read [docs/CONSTITUTION.md](./docs/CONSTITUTION.md) first. It states why the
system is shaped this way and how work is judged. `AGENTS.md` is the working
contract for coding agents, including the release procedure.

VibeKit is in alpha. The packages are unstable and APIs change without notice.

## Conventions

- Conventional commits. No co-author lines.
- Land tests with the code they cover.
- Run `bunx turbo run build typecheck test` before a commit.
- Run `bun run verify:packed` after changing package exports, manifests, or
  public types.
- Ask before adding a dependency.

## Review

A change that touches a transaction path, a signer, or the tool contract gets
an uncorrelated review: a different model from the author, and never the agent
that wrote it.
