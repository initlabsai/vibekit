import { describe, expect, test } from 'bun:test'

import {
  FIXTURE_RECEIVER,
  FIXTURE_SENDER,
  FIXTURE_TRANSACTION_ID,
  PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
} from '@initlabs/vibekit-explorer'

import { resolvePaymentParties, routeComposerInput } from '../src/commands.js'

describe('transcript command routing', () => {
  test('exact commands come first', () => {
    expect(routeComposerInput('accounts')).toEqual({ status: 'nav', screen: 'wallet' })
    expect(routeComposerInput('wallet')).toEqual({ status: 'nav', screen: 'wallet' })
    expect(routeComposerInput('my assets')).toEqual({ status: 'nav', screen: 'assets' })
    expect(routeComposerInput('assets')).toEqual({ status: 'nav', screen: 'assets' })
    expect(routeComposerInput('my apps')).toEqual({ status: 'nav', screen: 'apps' })
    expect(routeComposerInput('list my txns')).toEqual({ status: 'nav', screen: 'txns' })
    expect(routeComposerInput('list my accounts')).toEqual({ status: 'account-list' })
    expect(routeComposerInput('list my wallets')).toEqual({ status: 'account-list' })
    expect(routeComposerInput('show me my accounts')).toEqual({ status: 'account-list' })
    expect(routeComposerInput('my accounts')).toEqual({ status: 'account-list' })
    expect(routeComposerInput('blocks')).toEqual({ status: 'nav', screen: 'blocks' })
    expect(routeComposerInput('live')).toEqual({ status: 'nav', screen: 'blocks' })
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
    expect(routeComposerInput('asset 1042')).toEqual({ status: 'asset', assetId: 1042 })
    expect(routeComposerInput('app 1071')).toEqual({ status: 'application', applicationId: 1071 })
    expect(routeComposerInput('block 22')).toEqual({ status: 'block', round: 22 })
    expect(routeComposerInput('group AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=')).toEqual({
      status: 'group',
      groupId: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
    })
    expect(routeComposerInput('AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=')).toEqual({
      status: 'group',
      groupId: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
    })
  })

  test('NFD-shaped names route to the account-name lane', () => {
    expect(routeComposerInput('alice.algo')).toEqual({ status: 'account-name', name: 'alice.algo' })
    expect(routeComposerInput('  sub.name.algo ')).toEqual({
      status: 'account-name',
      name: 'sub.name.algo',
    })
    expect(routeComposerInput('Alice.algo')).toEqual({ status: 'text', text: 'Alice.algo' })
    expect(routeComposerInput('alice.algos')).toEqual({ status: 'text', text: 'alice.algos' })
  })

  test('typed pay names its receiver; the host only fills the sender', () => {
    const book = [
      { address: FIXTURE_SENDER, name: 'alice' },
      { address: FIXTURE_RECEIVER, name: 'bob' },
    ]
    expect(resolvePaymentParties(book, FIXTURE_SENDER, undefined)).toMatchObject({
      error: expect.stringContaining('Name the receiver'),
    })
    expect(resolvePaymentParties(book, FIXTURE_SENDER, 'Bob')).toEqual({
      sender: FIXTURE_SENDER,
      receiver: FIXTURE_RECEIVER,
    })
    expect(resolvePaymentParties(book, FIXTURE_SENDER, FIXTURE_RECEIVER)).toEqual({
      sender: FIXTURE_SENDER,
      receiver: FIXTURE_RECEIVER,
    })
    expect(resolvePaymentParties(book, FIXTURE_SENDER, 'carol')).toMatchObject({
      error: expect.stringContaining('No keystore account named'),
    })
    expect(routeComposerInput('pay 1.5 to bob')).toEqual({
      status: 'payment',
      amountMicroAlgos: 1500000,
      to: 'bob',
    })
  })

  test('everything else is conversation', () => {
    expect(routeComposerInput("what's my balance?")).toEqual({
      status: 'text',
      text: "what's my balance?",
    })
  })
})
