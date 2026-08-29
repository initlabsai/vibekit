import { describe, expect, test } from 'bun:test'

import {
  isRateLimited,
  normalizeToolError,
  RATE_LIMITED,
  ToolError,
} from '../../src/core/errors.js'

describe('rate limits from any source become one code', () => {
  test('recognizes a status, a nested response status, a message, and a classified ToolError', () => {
    expect(isRateLimited({ status: 429, message: 'Network request error' })).toBe(true)
    expect(isRateLimited({ response: { status: 429 } })).toBe(true)
    expect(isRateLimited(new Error('Too Many Requests'))).toBe(true)
    expect(isRateLimited(new Error("You've hit Exa's free MCP rate limit."))).toBe(true)
    expect(isRateLimited(new ToolError(RATE_LIMITED, 'x'))).toBe(true)
    expect(isRateLimited(new Error('Received status 404'))).toBe(false)
    expect(isRateLimited(new ToolError('INVALID_ARGS', 'rate limit is not what this says'))).toBe(
      false,
    )
  })

  test('normalizes to RATE_LIMITED with one calm sentence; other errors keep their own', () => {
    expect(normalizeToolError({ status: 429 })).toEqual({
      code: RATE_LIMITED,
      message: 'That source is rate-limited right now — try again in a minute.',
    })
    expect(normalizeToolError(new ToolError('MARKET_NOT_FOUND', 'no'))).toEqual({
      code: 'MARKET_NOT_FOUND',
      message: 'no',
    })
    expect(normalizeToolError({ message: 'plain object' })).toEqual({
      code: 'TOOL_ERROR',
      message: 'plain object',
    })
  })
})
