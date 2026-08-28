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

describe('her latest line', () => {
  test('is the last agent note across sections, or nothing', async () => {
    const { latestAgentNote } = await import('./feed')
    const note = (id: number, tone: 'agent' | 'muted') => ({ id, kind: 'note' as const, text: 'x', tone })
    expect(latestAgentNote([])).toBeUndefined()
    expect(
      latestAgentNote([
        { id: 1, prompt: 'a', items: [note(1, 'agent')] },
        { id: 2, prompt: 'b', items: [note(2, 'agent'), note(3, 'muted')] },
      ] as never),
    ).toEqual({ sectionId: 2, itemId: 2 })
  })
})
