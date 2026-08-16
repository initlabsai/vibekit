import { describe, expect, test } from 'bun:test'

import { renderKeyValue, renderTable, renderToolResult } from '../src/commands/explore/render.js'

describe('renderTable', () => {
  test('aligns columns across union of keys', () => {
    const out = renderTable([
      { asset: 'ALGO', amount: 5 },
      { asset: 'USDC', amount: 120, frozen: true },
    ])
    const lines = out.split('\n')
    expect(lines[0]).toMatch(/^asset\s+amount\s+frozen$/)
    expect(lines[1]).toMatch(/^─+\s+─+\s+─+$/)
    expect(lines[2]).toMatch(/^ALGO\s+5$/)
    expect(lines[3]).toMatch(/^USDC\s+120\s+true$/)
  })

  test('truncates past 15 rows', () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ n: i }))
    const out = renderTable(rows)
    expect(out).toContain('… 25 more rows')
  })

  test('handles empty input', () => {
    expect(renderTable([])).toBe('(no rows)')
  })
})

describe('renderToolResult', () => {
  test('table hint tabulates a nested single array property', () => {
    const out = renderToolResult(
      { balances: [{ address: 'AAA', amount: 1 }], nextToken: null },
      'table',
    )
    expect(out).toContain('address')
    expect(out).toContain('AAA')
  })

  test('account hint renders key/value with nested values inlined', () => {
    const out = renderToolResult({ address: 'AAA', amount: 5, status: 'Online' }, 'account')
    expect(out).toContain('address')
    expect(out.split('\n')).toHaveLength(3)
  })

  test('json fallback truncates long output', () => {
    const big = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, i]))
    const out = renderToolResult(big, 'json')
    expect(out).toContain('more lines')
  })

  test('markdown hint passes strings through', () => {
    expect(renderToolResult('# hi', 'markdown')).toBe('# hi')
  })
})

describe('renderKeyValue', () => {
  test('pads keys and truncates long nested values', () => {
    const out = renderKeyValue({ a: 1, longer: { deeply: { nested: 'x'.repeat(60) } } })
    const lines = out.split('\n')
    expect(lines[0]).toMatch(/^a\s+1$/)
    expect(lines[1]!.length).toBeLessThan(70)
    expect(lines[1]).toContain('…')
  })
})
