import { expect, test } from 'bun:test'

import { defaultNetwork } from './hooks'

test('the Explorer opens on mainnet', () => {
  expect(defaultNetwork()).toBe('mainnet')
})
