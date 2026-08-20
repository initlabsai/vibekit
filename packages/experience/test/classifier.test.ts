import { describe, expect, test } from 'bun:test'

import {
  FIXTURE_SENDER,
  FIXTURE_TRANSACTION_ID,
  classifyExplorerInput,
  createInputClassifier,
  defaultInputRecognizers,
  type InputRecognizer,
} from '../src/index.js'

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

  test('accepts an ordered custom recognizer registry without mutable global registration', () => {
    const prefixedTransaction: InputRecognizer = {
      id: 'prefixed-transaction',
      recognize(input) {
        if (!input.startsWith('txn:')) return undefined
        return { kind: 'entity', entity: 'transaction', value: input.slice(4) }
      },
    }
    const classify = createInputClassifier([prefixedTransaction, ...defaultInputRecognizers])

    expect(classify(`txn:${FIXTURE_TRANSACTION_ID}`)).toEqual({
      kind: 'entity',
      entity: 'transaction',
      value: FIXTURE_TRANSACTION_ID,
    })
  })
})
