# VibeKit Explorer

AI-powered Algorand blockchain explorer. Ask questions about accounts, transactions, assets, and applications in natural language.

## Setup

```sh
cp .env.example .env
# Fill in your LLM_API_KEY
```

## Development

```sh
# From monorepo root
bun install
bun run dev:explorer
```

## Environment Variables

See [`.env.example`](.env.example) for all available options. `LLM_BASE_URL` and `LLM_API_KEY` are required.
