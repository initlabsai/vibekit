import { describe, expect, test } from 'bun:test'

import { compactUsd, trimPrice } from '../src/cards/market.js'

describe('trimPrice', () => {
  test('keeps short prices exact and truncates long tails after leading zeros', () => {
    expect(trimPrice('1')).toBe('1')
    expect(trimPrice('0.093562874251497')).toBe('0.0935628')
    expect(trimPrice('0.0000013726957986338542')).toBe('0.00000137269')
    expect(trimPrice('0.25')).toBe('0.25')
    expect(trimPrice('1.000000000000')).toBe('1')
    expect(trimPrice('1.50')).toBe('1.5')
  })
})

describe('compactUsd', () => {
  test('scales across magnitudes and dashes the unknown', () => {
    expect(compactUsd(null)).toBe('—')
    expect(compactUsd(0)).toBe('$0.00')
    expect(compactUsd(999.994)).toBe('$999.99')
    expect(compactUsd(1_000)).toBe('$1.0K')
    expect(compactUsd(12_345)).toBe('$12.3K')
    expect(compactUsd(1_500_000)).toBe('$1.50M')
    expect(compactUsd(2_340_000_000)).toBe('$2.34B')
  })
})
