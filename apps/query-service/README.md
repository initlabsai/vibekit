# @vibekit/query-service

Natural language Algorand queries via HTTP. Handles LLM orchestration, tool calling, input classification, and data enrichment. Consumers make one HTTP call.

## Quick start

```bash
cp .env.example .env.local
bun install
bun run dev
```

Server starts on `http://localhost:3001`.

## Endpoints

### `POST /chat` — AI SDK protocol

For JS/TS consumers using `@ai-sdk/react`. Multi-turn, streaming, tool call rendering — all built in.

```bash
# Freetext (LLM path)
curl -X POST http://localhost:3001/chat \
  -H "Authorization: Bearer sk_dev_test123" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What is the ALGO balance of vibekit.algo?"}]}'

# Fast path with hint (skips LLM)
curl -X POST http://localhost:3001/chat \
  -H "Authorization: Bearer sk_dev_test123" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "vibekit.algo"}], "hint": {"calls": [{"tool": "resolve_nfd", "args": {"name": "vibekit.algo"}}]}}'
```

### `POST /query` — raw HTTP

For non-JS consumers (Python, curl, bots). Single query, no conversation history.

```bash
# NDJSON streaming (default)
curl -X POST http://localhost:3001/query \
  -H "Authorization: Bearer sk_dev_test123" \
  -H "Content-Type: application/json" \
  -d '{"query": "vibekit.algo"}'

# Collected JSON
curl -X POST http://localhost:3001/query \
  -H "Authorization: Bearer sk_dev_test123" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"query": "vibekit.algo"}'

# With customization
curl -X POST http://localhost:3001/query \
  -H "Authorization: Bearer sk_dev_test123" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"query": "network status", "tools": ["get_network_status"], "systemPrompt": "Be brief."}'
```

### Auth errors

```bash
# Missing key → 401
curl -X POST http://localhost:3001/query \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'

# Bad key → 401
curl -X POST http://localhost:3001/query \
  -H "Authorization: Bearer wrong_key" \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'
```

## Features

- **Two endpoints**: `/chat` (AI SDK protocol) and `/query` (NDJSON/JSON)
- **Fast path**: addresses, tx IDs, `.algo` names, and integers skip the LLM entirely (~200ms)
- **Multi-turn**: full conversation history via `/chat` endpoint
- **Streaming**: AI SDK protocol on `/chat`, NDJSON on `/query`
- **Tool filtering**: `tools` param restricts available tools per request
- **Custom system prompt**: `systemPrompt` param appends consumer-specific instructions
- **Auth**: Bearer token via `API_KEYS` env (comma-separated `label:key` pairs)
- **Rate limiting**: per API key, sliding window
- **Asset enrichment**: USD values, logos, verification tier via Pera API
- **NFD chaining**: `.algo` lookups auto-chain to account lookup on fast path

## Environment

See [.env.example](.env.example). Key variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_BASE_URL` | Yes | — | OpenAI-compatible API URL |
| `LLM_API_KEY` | Yes | — | API key for LLM provider |
| `LLM_MODEL` | No | `gpt-4o` | Model identifier |
| `API_KEYS` | No | `''` | Comma-separated `label:key` pairs |
| `PORT` | No | `3001` | Server port |

## Docker

```bash
docker build -t query-service -f apps/query-service/Dockerfile .
docker run -p 3001:3001 --env-file apps/query-service/.env.local query-service
```

## See also

- [EXAMPLES.md](./EXAMPLES.md) — React, Python, and curl integration examples
- [SERVICE.md](../../SERVICE.md) — architecture and roadmap
