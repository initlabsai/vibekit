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

  test('restricts to a tool-capable host set and sorts by throughput unless the body already set provider', () => {
    expect(applyOpenRouterProviderPrefs({ model: 'deepseek/deepseek-v4-flash-0731', messages: [] })).toEqual({
      model: 'deepseek/deepseek-v4-flash-0731',
      messages: [],
      provider: {
        require_parameters: true,
        only: ['together', 'fireworks', 'deepinfra', 'parasail'],
        sort: 'throughput',
      },
    })
    expect(OPENROUTER_AGENT_PROVIDER.only).toEqual(['together', 'fireworks', 'deepinfra', 'parasail'])
    const pinned = { provider: { order: ['Together'] } }
    expect(applyOpenRouterProviderPrefs(pinned)).toBe(pinned)
  })
})
