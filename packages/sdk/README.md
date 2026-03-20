# @getvibekit/sdk

TypeScript SDK for the [VibeKit](https://getvibekit.ai) API.

## Install

```bash
npm install @getvibekit/sdk
```

`ai` is a peer dependency (for `DefaultChatTransport`):

```bash
npm install ai @ai-sdk/react
```

## Chat (React)

```tsx
import { useChat } from '@ai-sdk/react'
import { VibeKit, alphaArcadeTools } from '@getvibekit/sdk'

const vk = new VibeKit({ apiKey: 'sk_...' })

function Chat() {
  const { messages, sendMessage } = useChat({
    transport: vk.chat({
      systemPrompt: 'Focus on prediction markets',
      tools: [...alphaArcadeTools],
    }),
  })

  return (
    <div>
      {messages.map((m) => <div key={m.id}>{m.content}</div>)}
      <button onClick={() => sendMessage({ text: 'Show me live markets' })}>Ask</button>
    </div>
  )
}
```

## Query (one-shot)

```ts
const vk = new VibeKit({ apiKey: 'sk_...' })
const result = await vk.query('show me live prediction markets')
console.log(result.text)
console.log(result.toolResults)
```

## Streaming

```ts
for await (const event of vk.queryStream('live markets')) {
  if (event.type === 'tool_result') console.log(event.tool, event.data)
  if (event.type === 'text') process.stdout.write(event.content)
}
```

## Tool presets

```ts
import { alphaArcadeTools, explorerTools, allTools } from '@getvibekit/sdk'
```
