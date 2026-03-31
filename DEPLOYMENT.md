# Deployment

How to deploy each app in the monorepo. See [AGENTS.md](./AGENTS.md) for dev commands.

## API (`apps/api`)

Hono/Bun server deployed to **Fly.io** as a Docker container.

### Deploy

```bash
fly deploy
```

This builds the Docker image from `apps/api/Dockerfile` and deploys to the `vibekit-api` app. Config is in `fly.toml` at the repo root.

### Set secrets

```bash
fly secrets set LLM_BASE_URL=https://api.together.xyz/v1
fly secrets set LLM_API_KEY=your-key
fly secrets set LLM_MODEL=your-model
fly secrets set API_KEYS=label1:sk_key1,label2:sk_key2
fly secrets set ALPHA_ARCADE_API_KEY=your-key
```

See `apps/api/.env.example` for all available env vars.

### Useful commands

```bash
fly status                # Check app status
fly logs                  # Tail logs
fly machine restart       # Restart if stuck
fly secrets list          # List configured secrets
```

---

## Explorer (`apps/explorer`)

Next.js chat UI deployed to **Vercel**.

### Deploy

Vercel auto-deploys on push to `main`. To deploy manually:

```bash
cd apps/explorer
vercel --prod
```

### Environment variables

Set these in the Vercel dashboard or via CLI:

```bash
vercel env add NEXT_PUBLIC_QUERY_SERVICE_URL    # https://api.getvibekit.ai
vercel env add NEXT_PUBLIC_QUERY_SERVICE_KEY    # API key for the query service
```

---

## Website (`apps/website`)

Astro/Starlight docs site deployed to **Vercel** at [getvibekit.ai](https://getvibekit.ai).

### Deploy

Vercel auto-deploys on push to `main`. To deploy manually:

```bash
cd apps/website
vercel --prod
```

---

## CLI (`apps/cli`)

Standalone binary distributed via **GitHub Releases**.

### Release

1. Update the version in `apps/cli/package.json`
2. Tag and push:

```bash
git tag cli-v0.2.0
git push origin cli-v0.2.0
```

GitHub Actions builds binaries for all platforms (linux-x64, darwin-arm64, darwin-x64, win32-x64) and creates the release automatically.

Tags containing `-alpha`, `-beta`, or `-rc` are marked as prereleases.

### Install (end users)

```bash
curl -fsSL https://getvibekit.ai/install | sh
```

---

## SDK (`packages/sdk`)

Published to **npm** as `@getvibekit/sdk`.

### Publish

1. Bump the version in `packages/sdk/package.json`
2. Build and publish:

```bash
bun run --filter @vibekit/alpha-arcade build   # build dependency first
bun run --filter @getvibekit/sdk build          # generates types + compiles
cd packages/sdk && npm publish --access public
```

The build runs `sync-types` automatically to inline types from `@vibekit/alpha-arcade`, so the published package has no workspace dependencies.

### Verify

```bash
npm view @getvibekit/sdk versions
```

---

## MCP Server (`apps/mcp-server`)

Not deployed — runs locally, started via `vibekit mcp`. Built and distributed as part of the CLI.
