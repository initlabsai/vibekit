import { describe, expect, test } from 'bun:test'

import { chartGeometry, compact } from './chart'

describe('network chart', () => {
  test('spreads points across the width and scales the range into the padded height', () => {
    const { xs, ys } = chartGeometry([1, 3, 2], 100, 50)
    expect(xs).toEqual([0, 50, 100])
    expect(ys[1]).toBe(6)
    expect(ys[0]).toBe(44)
    expect(ys[2]).toBe(25)
  })

  test('a flat line sits at the bottom of the box and one point draws nothing', () => {
    expect(chartGeometry([2, 2], 10, 20).ys).toEqual([14, 14])
    expect(chartGeometry([2], 10, 20).xs).toEqual([])
  })

  test('compacts large counts', () => {
    expect(compact(10_000_000_000)).toBe('10.0B')
    expect(compact(1_893_271)).toBe('1.9M')
    expect(compact(42)).toBe('42.0')
  })
})
