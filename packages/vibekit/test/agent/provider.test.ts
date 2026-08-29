import { describe, expect, test } from 'bun:test'

import {
  applyOpenRouterProviderPrefs,
  isOpenRouterBaseUrl,
  OPENROUTER_AGENT_PROVIDER,
} from '../../src/agent/provider.js'

describe('OpenRouter routing', () => {
  test('recognises the chat host and not Together or a local proxy', () => {
    expect(isOpenRouterBaseUrl('https://openrouter.ai/api/v1')).toBe(true)
    expect(isOpenRouterBaseUrl('https://openrouter.ai/api/v1/')).toBe(true)
    expect(isOpenRouterBaseUrl('https://api.together.xyz/v1')).toBe(false)
    expect(isOpenRouterBaseUrl('http://localhost:11434/v1')).toBe(false)
    expect(isOpenRouterBaseUrl('not a url')).toBe(false)
  })

  test('tries Fireworks then Together unless the body already set provider', () => {
    expect(applyOpenRouterProviderPrefs({ model: 'deepseek/deepseek-v4-flash-0731', messages: [] })).toEqual({
      model: 'deepseek/deepseek-v4-flash-0731',
      messages: [],
      provider: {
        require_parameters: true,
        order: ['fireworks', 'together'],
        allow_fallbacks: true,
      },
    })
    expect(OPENROUTER_AGENT_PROVIDER.order).toEqual(['fireworks', 'together'])
    const pinned = { provider: { order: ['Together'] } }
    expect(applyOpenRouterProviderPrefs(pinned)).toBe(pinned)
  })
})
