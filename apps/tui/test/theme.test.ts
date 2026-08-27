import { expect, test } from 'bun:test'

import { errorMessage, shorten } from '../src/theme.js'

test('errorMessage drops algosdk transport prefixes and keeps the message', () => {
  expect(
    errorMessage(
      new Error(
        'Network request error. Received status 404 (Not Found): no assets found for asset-id: 9',
      ),
    ),
  ).toBe('no assets found for asset-id: 9')
  expect(errorMessage(new Error('plain'))).toBe('plain')
  expect(errorMessage('string')).toBe('string')
})

test('shorten keeps both ends', () => {
  expect(shorten('ABCDEFGHIJ', 7)).toBe('ABC…HIJ')
  expect(shorten('short', 10)).toBe('short')
})

test('gradient and breath stay inside their endpoints', () => {
  const { gradient, breath, lerpColor } =
    require('../src/theme.js') as typeof import('../src/theme.js')
  expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080')
  expect(gradient('#2e5c5e', '#6fd3d3', 3)).toEqual(['#2e5c5e', '#4f9899', '#6fd3d3'])
  // up then down, endpoints once each, so the loop has no seam
  expect(breath('#000000', '#ffffff', 3)).toEqual(['#000000', '#808080', '#ffffff', '#808080'])
})
