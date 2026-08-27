import { describe, expect, test } from 'bun:test'
import { base64ToBytes, bytesToBase64, jsonSafe } from '../src/codec.js'

describe('jsonSafe', () => {
  test('small bigint → number', () => {
    expect(jsonSafe(BigInt(42))).toBe(42)
    expect(jsonSafe(BigInt(-7))).toBe(-7)
  })

  test('huge bigint → decimal string', () => {
    const huge = BigInt('18446744073709551615')
    expect(jsonSafe(huge)).toBe('18446744073709551615')
  })

  test('Uint8Array → base64', () => {
    expect(jsonSafe(new Uint8Array([1, 2, 3]))).toBe('AQID')
  })

  test('nested structures, undefined entries dropped', () => {
    const input = {
      round: BigInt(107),
      note: new Uint8Array([104, 105]),
      skip: undefined,
      list: [BigInt(1), { deep: BigInt('99999999999999999999') }],
    }
    expect(jsonSafe(input)).toEqual({
      round: 107,
      note: 'aGk=',
      list: [1, { deep: '99999999999999999999' }],
    })
  })

  test('maps become plain objects', () => {
    expect(jsonSafe(new Map([['a', BigInt(1)]]))).toEqual({ a: 1 })
  })

  test('survives JSON.stringify', () => {
    const safe = jsonSafe({ a: BigInt(1), b: new Uint8Array([0]) })
    expect(() => JSON.stringify(safe)).not.toThrow()
  })
})

describe('base64 round-trip', () => {
  test('bytes → base64 → bytes', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255])
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
  })
})
