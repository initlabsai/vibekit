import { describe, expect, test } from 'bun:test'

import {
  createInitialWorkspaceState,
  createTransactionFixtureOpenCommand,
  FIXTURE_SENDER,
  FIXTURE_TRANSACTION_ID,
  workspaceReducer,
} from '@initlabs/vibekit-experience'

import { createFocusCommand, routeComposerInput } from './commands.js'

describe('web semantic wiring', () => {
  test('routes the fixture through the shared classifier and open command', () => {
    const outcome = routeComposerInput(FIXTURE_TRANSACTION_ID)
    expect(outcome.status).toBe('resolved')
    expect(outcome.status === 'resolved' ? outcome.command : undefined).toEqual(
      createTransactionFixtureOpenCommand(),
    )
  })

  test('routes a pasted address to the account lane', () => {
    expect(routeComposerInput(FIXTURE_SENDER)).toEqual({
      status: 'account',
      address: FIXTURE_SENDER,
    })
  })

  test('the reducer remains renderer-independent', () => {
    const state = workspaceReducer(
      createInitialWorkspaceState(),
      createTransactionFixtureOpenCommand(),
    )
    const focused = workspaceReducer(
      state,
      createFocusCommand({ area: 'workspace', artifactId: 'artifact-fixture-transaction-001' }),
    )
    expect(focused.focus).toEqual({
      area: 'workspace',
      artifactId: 'artifact-fixture-transaction-001',
    })
  })
})
