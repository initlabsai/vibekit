import { describe, expect, test } from 'bun:test'

import { filterRows, nextSort } from './tables.js'

describe('table sort and filter', () => {
  test('a header click cycles none → asc → desc → none; another key restarts', () => {
    const asc = nextSort(null, 'amount')
    expect(asc).toEqual({ key: 'amount', direction: 'asc' })
    const desc = nextSort(asc, 'amount')
    expect(desc).toEqual({ key: 'amount', direction: 'desc' })
    expect(nextSort(desc, 'amount')).toBeNull()
    expect(nextSort(desc, 'id')).toEqual({ key: 'id', direction: 'asc' })
  })

  test('filter matches every word against the row text on the current page only', () => {
    const rows = [
      { name: 'USDC', id: 31566704 },
      { name: 'goBTC', id: 386192725 },
    ]
    const text = (row: (typeof rows)[number]) => `${row.name} ${row.id}`
    expect(filterRows(rows, 'usd', text)).toEqual([rows[0]!])
    expect(filterRows(rows, 'go 386', text)).toEqual([rows[1]!])
    expect(filterRows(rows, '', text)).toBe(rows)
  })
})
