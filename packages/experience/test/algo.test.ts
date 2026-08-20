import { describe, expect, test } from 'bun:test'

import { formatMicroAlgos, parseAlgosToMicroAlgos, sameUint64 } from '../src/index.js'

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
    expect(formatMicroAlgos('18446744073709551615')).toBe('18446744073709.551615')
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

  test('compares wire uint64 values across number and string encodings', () => {
    expect(sameUint64(250000, '250000')).toBeTrue()
    expect(sameUint64('18446744073709551615', '18446744073709551615')).toBeTrue()
    expect(sameUint64(250000, 250001)).toBeFalse()
  })
})
