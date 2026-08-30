import { describe, expect, test } from 'bun:test'

import { FIXTURE_SENDER, FIXTURE_TRANSACTION_ID, classifyExplorerInput } from '../../src/views/index.js'

describe('deterministic Explorer input classification', () => {
  test('recognizes a canonical Algorand transaction ID', () => {
    expect(classifyExplorerInput(`  ${FIXTURE_TRANSACTION_ID}\n`)).toEqual({
      kind: 'entity',
      entity: 'transaction',
      value: FIXTURE_TRANSACTION_ID,
    })
  })

  test.each([
    FIXTURE_TRANSACTION_ID.slice(0, -1),
    `${FIXTURE_TRANSACTION_ID.slice(0, -1)}B`,
    FIXTURE_TRANSACTION_ID.toLowerCase(),
    `0${FIXTURE_TRANSACTION_ID.slice(1)}`,
  ])('does not classify malformed transaction-like input: %s', (input) => {
    expect(classifyExplorerInput(input)).toEqual({
      kind: 'text',
      value: input,
    })
  })

  test('recognizes an address candidate through its dedicated extension point', () => {
    expect(classifyExplorerInput(FIXTURE_SENDER)).toEqual({
      kind: 'entity',
      entity: 'account',
      value: FIXTURE_SENDER,
    })
  })

  test('recognizes a 32-byte group id in standard or URL-safe base64', () => {
    const standard = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE='
    const urlSafe = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA_='
    expect(classifyExplorerInput(standard)).toEqual({
      kind: 'entity',
      entity: 'group',
      value: standard,
    })
    expect(classifyExplorerInput(urlSafe)).toEqual({
      kind: 'entity',
      entity: 'group',
      value: urlSafe,
    })
    expect(classifyExplorerInput('abc123')).toEqual({ kind: 'text', value: 'abc123' })
  })

  test('keeps bare numeric IDs ambiguous across assets, applications, and blocks', () => {
    expect(classifyExplorerInput('1022')).toEqual({
      kind: 'ambiguous-entity',
      value: '1022',
      candidates: ['asset', 'application', 'block'],
    })
  })

  test.each(['alice.algo', 'sub.name.algo', 'a-1.algo', '  vibekit.algo\n'])(
    'recognizes an NFD-shaped account name: %s',
    (input) => {
      expect(classifyExplorerInput(input)).toEqual({
        kind: 'entity',
        entity: 'account-name',
        value: input.trim(),
      })
    },
  )

  test.each(['Alice.algo', '.algo', 'alice.', 'alice.algo.', 'al ice.algo', 'alice.algorand'])(
    'does not classify malformed name-like input as an account name: %s',
    (input) => {
      expect(classifyExplorerInput(input).kind).toBe('text')
    },
  )
})
