---
title: Swap the model
description: Any OpenAI-compatible endpoint, Anthropic, Ollama, or ZeroSignal — one option.
draft: false
---

`model` on `createAgent` and `createAgentHandler` is a provider config or any
AI SDK `LanguageModel`:

```ts
model: { provider: 'openai-compatible', baseUrl: 'https://openrouter.ai/api/v1', apiKey, model: 'z-ai/glm-5.3-flash' }
model: { provider: 'anthropic', model: 'claude-sonnet-5' }        // ANTHROPIC_API_KEY
model: { provider: 'ollama', model: 'qwen3:8b' }                   // localhost:11434
model: { provider: 'zerosignal', model: 'qwen3:8b' }               // zs-proxy on localhost:8080, no key
```

Nothing in the package reads the environment; the web agent's route maps its
env vars onto this option in one place. Example:
[`examples/agent-http.ts`](https://github.com/initlabsai/vibekit/blob/main/packages/vibekit/examples/agent-http.ts).
