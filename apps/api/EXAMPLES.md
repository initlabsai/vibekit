# Query Service — Usage Examples

## AI SDK (recommended for JS/TS)

The `/chat` endpoint speaks the AI SDK UI message stream protocol. Install `@ai-sdk/react` and you get multi-turn conversation, streaming tool calls, and usage metadata out of the box. No LLM provider packages needed — the query service handles that.

```bash
npm install @ai-sdk/react
```

### Basic chat

```tsx
import { useChat } from '@ai-sdk/react'

function Explorer() {
  const { messages, input, setInput, sendMessage, status } = useChat({
    api: 'https://query.vibekit.ai/chat',
    headers: { Authorization: 'Bearer sk_your_key' },
  })

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>
          {msg.parts.map((part, i) => {
            if (part.type === 'text') return <p key={i}>{part.text}</p>
            if (part.type === 'tool-invocation') {
              return <DataCard key={i} tool={part.toolInvocation.toolName} data={part.toolInvocation.output} />
            }
            return null
          })}
        </div>
      ))}
      <form onSubmit={(e) => { e.preventDefault(); sendMessage({ text: input }); setInput('') }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} />
      </form>
    </div>
  )
}
```

### With fast-path hints

Client-side input classification skips the LLM for addresses, tx IDs, and `.algo` names:

```tsx
import { useChat } from '@ai-sdk/react'

// These functions are exported from the query service — copy them or import from a shared package
function classifyInput(raw: string) {
  const trimmed = raw.trim()
  if (/^[A-Z2-7]{58}$/.test(trimmed)) return { kind: 'address', value: trimmed }
  if (/^[A-Z2-7]{52}$/.test(trimmed)) return { kind: 'transaction', value: trimmed }
  if (/^[\w.-]+\.algo$/i.test(trimmed)) return { kind: 'nfd', value: trimmed }
  if (/^\d+$/.test(trimmed)) return { kind: 'integer', value: trimmed }
  return { kind: 'freetext', value: trimmed }
}

function buildHint(input: ReturnType<typeof classifyInput>) {
  switch (input.kind) {
    case 'address': return { calls: [{ tool: 'lookup_account', args: { address: input.value } }] }
    case 'transaction': return { calls: [{ tool: 'lookup_transaction', args: { txid: input.value } }] }
    case 'nfd': return { calls: [{ tool: 'resolve_nfd', args: { name: input.value } }] }
    case 'integer': return {
      tryAll: true,
      calls: [
        { tool: 'lookup_block', args: { round: parseInt(input.value, 10) } },
        { tool: 'lookup_asset', args: { assetId: parseInt(input.value, 10) } },
        { tool: 'lookup_application', args: { applicationId: parseInt(input.value, 10) } },
      ],
    }
    default: return null
  }
}

function Explorer() {
  const { messages, sendMessage, status } = useChat({
    api: 'https://query.vibekit.ai/chat',
    headers: { Authorization: 'Bearer sk_your_key' },
  })

  function handleSubmit(text: string) {
    const hint = buildHint(classifyInput(text))
    if (hint) {
      sendMessage({ text }, { body: { hint } })
    } else {
      sendMessage({ text })
    }
  }

  // ... render messages
}
```

### Usage metadata

Token usage and context window size are available on message metadata:

```tsx
const { messages } = useChat({ api: 'https://query.vibekit.ai/chat', /* ... */ })

for (const msg of messages) {
  const meta = msg.metadata as { usage?: { inputTokens: number; outputTokens: number; totalTokens: number }; contextWindowSize?: number }
  if (meta?.usage) {
    console.log(`Tokens: ${meta.usage.totalTokens} / ${meta.contextWindowSize}`)
  }
}
```

## Raw HTTP — `/query` endpoint

For non-JS consumers (Python, curl, server-to-server). No AI SDK needed.

### Streaming (NDJSON)

```bash
curl -X POST https://query.vibekit.ai/query \
  -H "Authorization: Bearer sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"query": "VIBEKIT.algo"}'
```

```jsonl
{"type":"tool_call","tool":"resolve_nfd","args":{"name":"vibekit.algo"}}
{"type":"tool_result","tool":"resolve_nfd","data":{"name":"vibekit.algo","address":"ABC..."}}
{"type":"text","content":"VIBEKIT.algo holds 1,234 ALGO."}
{"type":"done","usage":{"inputTokens":512,"outputTokens":89}}
```

### Non-streaming (JSON)

```bash
curl -X POST https://query.vibekit.ai/query \
  -H "Authorization: Bearer sk_your_key" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"query": "VIBEKIT.algo"}'
```

```json
{
  "text": "VIBEKIT.algo holds 1,234 ALGO.",
  "toolResults": [
    {"tool": "resolve_nfd", "data": {"name": "vibekit.algo", "address": "ABC..."}}
  ],
  "usage": {"inputTokens": 512, "outputTokens": 89}
}
```

### Python example

```python
import requests

res = requests.post(
    "https://query.vibekit.ai/query",
    headers={"Authorization": "Bearer sk_your_key", "Accept": "application/json"},
    json={"query": "VIBEKIT.algo"},
)
data = res.json()
print(data["text"])
```

## Customization

Both endpoints accept optional `systemPrompt` and `tools` parameters to tailor behavior per consumer. The base system prompt is always included — `systemPrompt` appends to it, never replaces it. `tools` filters the available tool set by name.

### Custom system prompt (AI SDK)

```tsx
const { messages, sendMessage } = useChat({
  api: 'https://query.vibekit.ai/chat',
  headers: { Authorization: 'Bearer sk_your_key' },
  body: {
    systemPrompt: 'Focus on prediction markets. Always mention current odds when discussing markets.',
  },
})
```

### Tool filtering (AI SDK)

Restrict which tools the LLM can call — useful for focused UIs:

```tsx
const { messages, sendMessage } = useChat({
  api: 'https://query.vibekit.ai/chat',
  headers: { Authorization: 'Bearer sk_your_key' },
  body: {
    tools: ['resolve_nfd', 'lookup_account', 'get_account_portfolio'],
  },
})
```

### Both options via `/query`

```bash
curl -X POST https://query.vibekit.ai/query \
  -H "Authorization: Bearer sk_your_key" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "query": "Show me vibekit.algo",
    "tools": ["resolve_nfd", "lookup_account"],
    "systemPrompt": "Keep responses under 50 words."
  }'
```

### Python with customization

```python
import requests

res = requests.post(
    "https://query.vibekit.ai/query",
    headers={"Authorization": "Bearer sk_your_key", "Accept": "application/json"},
    json={
        "query": "What prediction markets are active?",
        "systemPrompt": "Focus on prediction markets. Format odds as percentages.",
        "tools": ["get_live_markets", "get_market"],
    },
)
data = res.json()
print(data["text"])
```

## Which endpoint to use

| | `/chat` (AI SDK) | `/query` (raw HTTP) |
|---|---|---|
| **Multi-turn** | Built in | No (single query) |
| **Streaming** | AI SDK protocol (automatic) | NDJSON (parse yourself) |
| **Tool call rendering** | Handled by `useChat` | Manual event handling |
| **Best for** | React/Next.js/JS apps | Python, curl, non-JS |
| **Dependencies** | `@ai-sdk/react` | None |

The fast path (addresses, tx IDs, `.algo` names) skips the LLM entirely on both endpoints — tool results return in ~200ms with no token usage.
