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

describe('out of turns', () => {
  test('she names the offer and varies the line', async () => {
    const { outOfTurnsLine } = await import('../features/agent/hooks')
    const lines = [0, 1, 2, 3].map((seed) => outOfTurnsLine(seed, { price: '$1.00', turns: 25 }))
    expect(new Set(lines).size).toBe(4)
    for (const line of lines) expect(line).toContain('/buy 25 for $1.00')
    expect(outOfTurnsLine(0)).toContain('/buy a pack')
  })
})

describe('leaked tool markup', () => {
  test('is stripped, and an empty turn asks for a retry', async () => {
    const { plainAgentText } = await import('./feed')
    const leaked = '<｜DSML｜tool_calls>\n<｜DSML｜invoke name="lookup_asset">\n<｜DSML｜parameter name="assetId" string="false">2582294183</｜DSML｜parameter>\n</｜DSML｜invoke>\n</｜DSML｜tool_calls>'
    expect(plainAgentText(leaked)).toMatch(/ask me again/)
    expect(plainAgentText(`looking that up. ${leaked}`)).toBe('looking that up.')
    expect(plainAgentText('plain words stay')).toBe('plain words stay')
  })
})
