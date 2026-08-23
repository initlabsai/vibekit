import { expect, test } from 'bun:test'

import { errorMessage, shorten } from '../src/theme.js'

test('errorMessage drops algosdk transport prefixes and keeps the message', () => {
  expect(
    errorMessage(new Error('Network request error. Received status 404 (Not Found): no assets found for asset-id: 9')),
  ).toBe('no assets found for asset-id: 9')
  expect(errorMessage(new Error('plain'))).toBe('plain')
  expect(errorMessage('string')).toBe('string')
})

test('shorten keeps both ends', () => {
  expect(shorten('ABCDEFGHIJ', 7)).toBe('ABC…GHI')
  expect(shorten('short', 10)).toBe('short')
})
