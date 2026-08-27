import { describe, expect, test } from 'bun:test'

import {
  FIXTURE_RESULT_ID,
  FIXTURE_SENDER,
  FIXTURE_TRANSACTION_ID,
} from '@initlabs/vibekit-explorer'

import { routeComposerInput } from './commands.js'

describe('web semantic wiring', () => {
  test('routes the fixture through the shared classifier to a trusted artifact', () => {
    const outcome = routeComposerInput(FIXTURE_TRANSACTION_ID)
    expect(outcome.status).toBe('resolved')
    if (outcome.status !== 'resolved') throw new Error('Expected resolved fixture')
    expect(outcome.artifact).toEqual({
      title: 'Transaction detail',
      view: {
        protocolVersion: '0.1.0',
        type: 'view',
        view: 'transaction.detail',
        source: { source: 'result', id: FIXTURE_RESULT_ID },
      },
    })
  })

  test('routes a pasted address to the account lane', () => {
    expect(routeComposerInput(FIXTURE_SENDER)).toEqual({
      status: 'account',
      address: FIXTURE_SENDER,
    })
  })
})
