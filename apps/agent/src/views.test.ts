import { expect, test } from 'bun:test'

import { welcomeExamples } from './views'

test('mainnet intro names ecosystem reads', () => {
  expect(welcomeExamples('mainnet')).toContain('who is vibekit.algo?')
  expect(welcomeExamples('mainnet')).toContain("get algorand's price chart")
})

test('testnet and localnet intros never ask for a name that is not there', () => {
  for (const network of ['testnet', 'localnet', 'betanet']) {
    const examples = welcomeExamples(network)
    expect(examples.some((example) => example.includes('.algo'))).toBe(false)
    expect(examples).toContain('/blocks')
    expect(examples).toContain('/status')
  }
  expect(welcomeExamples('testnet')[0]).toBe('what is asset 10458941?')
})
