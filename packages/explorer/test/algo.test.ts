import { describe, expect, test } from 'bun:test'

import {
  formatBaseUnits,
  formatMicroAlgos,
  parseAlgosToMicroAlgos,
  sameUint64,
} from '../src/index.js'

describe('exact microALGO math', () => {
  test('formats microALGOs as exact decimal ALGO strings', () => {
    expect(formatMicroAlgos(0)).toBe('0')
    expect(formatMicroAlgos(1)).toBe('0.000001')
    expect(formatMicroAlgos(1000)).toBe('0.001')
    expect(formatMicroAlgos(250000)).toBe('0.25')
    expect(formatMicroAlgos(251000)).toBe('0.251')
    expect(formatMicroAlgos(-251000)).toBe('-0.251')
    expect(formatMicroAlgos(1000000)).toBe('1')
    expect(formatMicroAlgos(123456789)).toBe('123.456789')
    expect(formatMicroAlgos('18446744073709551615')).toBe('18,446,744,073,709.551615')
    expect(formatMicroAlgos('-0')).toBe('0')
    expect(() => formatMicroAlgos('1.5')).toThrow()
  })

  test('parses decimal ALGO amounts into exact safe-integer microALGOs', () => {
    expect(parseAlgosToMicroAlgos('0.25')).toBe(250000)
    expect(parseAlgosToMicroAlgos('1')).toBe(1000000)
    expect(parseAlgosToMicroAlgos(' 0.000001 ')).toBe(1)
    expect(parseAlgosToMicroAlgos('123.456789')).toBe(123456789)
    expect(parseAlgosToMicroAlgos('0.1234567')).toBeUndefined()
    expect(parseAlgosToMicroAlgos('-1')).toBeUndefined()
    expect(parseAlgosToMicroAlgos('1e6')).toBeUndefined()
    expect(parseAlgosToMicroAlgos('abc')).toBeUndefined()
    expect(parseAlgosToMicroAlgos('99999999999999999999')).toBeUndefined()
  })

  test('round-trips exactly through format and parse', () => {
    for (const micro of [1, 999, 1000, 250000, 1000001, 123456789]) {
      expect(parseAlgosToMicroAlgos(formatMicroAlgos(micro))).toBe(micro)
    }
  })

  test('formats ASA base units with exact decimal places', () => {
    expect(formatBaseUnits(52000, 2)).toBe('520')
    expect(formatBaseUnits(52000, 0)).toBe('52,000')
    expect(formatBaseUnits(1_000_000_000, 6)).toBe('1,000')
    expect(formatBaseUnits('1000000', 6)).toBe('1')
    expect(formatBaseUnits(1, 2)).toBe('0.01')
    expect(() => formatBaseUnits(1, -1)).toThrow()
  })

  test('compares wire uint64 values across number and string encodings', () => {
    expect(sameUint64(250000, '250000')).toBeTrue()
    expect(sameUint64('18446744073709551615', '18446744073709551615')).toBeTrue()
    expect(sameUint64(250000, 250001)).toBeFalse()
  })
})
