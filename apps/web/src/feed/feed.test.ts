import { describe, expect, test } from 'bun:test'

import { plainAgentText } from './feed'

describe('agent transcript text', () => {
  test('drops stray markdown styling without changing the answer', () => {
    expect(plainAgentText('That is **USDC** at `31566704`.')).toBe('That is USDC at 31566704.')
  })

  test('leaves unmatched punctuation alone', () => {
    expect(plainAgentText('2 ** 3 and `unfinished')).toBe('2 ** 3 and `unfinished')
  })
})
