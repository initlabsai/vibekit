import { describe, expect, test } from 'bun:test'

import {
  FIXTURE_SENDER,
  FIXTURE_TRANSACTION_ID,
  PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
} from '@initlabs/vibekit-experience'

import { routeComposerInput } from '../src/commands.js'

describe('transcript command routing', () => {
  test('exact commands come first', () => {
    expect(routeComposerInput('accounts')).toEqual({ status: 'nav', screen: 'accounts' })
    expect(routeComposerInput(' SAMPLE ')).toEqual({ status: 'sample' })
    expect(routeComposerInput('help')).toEqual({ status: 'help' })
    expect(routeComposerInput('pay 1.5')).toEqual({ status: 'payment', amountMicroAlgos: 1500000 })
    expect(routeComposerInput('pay')).toEqual({
      status: 'payment',
      amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
    })
  })

  test('network commands switch or report', () => {
    expect(routeComposerInput('network')).toEqual({ status: 'network' })
    expect(routeComposerInput('network testnet')).toEqual({ status: 'network', network: 'testnet' })
    expect(routeComposerInput('NETWORK MainNet')).toEqual({ status: 'network', network: 'mainnet' })
    expect(routeComposerInput('network devnet')).toEqual({ status: 'text', text: 'network devnet' })
  })

  test('identifiers route deterministically', () => {
    expect(routeComposerInput(FIXTURE_TRANSACTION_ID)).toEqual({
      status: 'transaction',
      txid: FIXTURE_TRANSACTION_ID,
    })
    expect(routeComposerInput(FIXTURE_SENDER)).toEqual({
      status: 'account',
      address: FIXTURE_SENDER,
    })
    expect(routeComposerInput('1022')).toEqual({ status: 'ambiguous', value: '1022' })
  })

  test('everything else is conversation', () => {
    expect(routeComposerInput("what's my balance?")).toEqual({
      status: 'text',
      text: "what's my balance?",
    })
  })
})
