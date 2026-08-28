import { describe, expect, test } from 'bun:test'

import {
  FIXTURE_RECEIVER,
  FIXTURE_SENDER,
  FIXTURE_TRANSACTION_ID,
  PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
} from '@initlabs/vibekit-explorer'

import { resolvePaymentParties, routeComposerInput } from './commands.js'

describe('web composer routing', () => {
  test('identifiers route deterministically', () => {
    expect(routeComposerInput(FIXTURE_TRANSACTION_ID)).toEqual({
      status: 'transaction',
      txid: FIXTURE_TRANSACTION_ID,
    })
    expect(routeComposerInput(FIXTURE_SENDER)).toEqual({ status: 'account', address: FIXTURE_SENDER })
    expect(routeComposerInput('1022')).toEqual({ status: 'ambiguous', value: '1022' })
    expect(routeComposerInput('asset 1042')).toEqual({ status: 'asset', assetId: 1042 })
    expect(routeComposerInput('app 1071')).toEqual({ status: 'application', applicationId: 1071 })
    expect(routeComposerInput('block 22')).toEqual({ status: 'block', round: 22 })
    expect(routeComposerInput('group AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=')).toEqual({
      status: 'group',
      groupId: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
    })
    expect(routeComposerInput('alice.algo')).toEqual({ status: 'account-name', name: 'alice.algo' })
  })

  test('app words: nav, network, help, account list', () => {
    expect(routeComposerInput('wallet')).toEqual({ status: 'nav', screen: 'wallet' })
    expect(routeComposerInput('my assets')).toEqual({ status: 'nav', screen: 'assets' })
    expect(routeComposerInput('list my txns')).toEqual({ status: 'nav', screen: 'txns' })
    expect(routeComposerInput('blocks')).toEqual({ status: 'nav', screen: 'blocks' })
    expect(routeComposerInput('show me my accounts')).toEqual({ status: 'account-list' })
    expect(routeComposerInput('network')).toEqual({ status: 'network' })
    expect(routeComposerInput('NETWORK TestNet')).toEqual({ status: 'network', network: 'testnet' })
    expect(routeComposerInput('help')).toEqual({ status: 'help' })
    expect(routeComposerInput("what's my balance?")).toEqual({
      status: 'text',
      text: "what's my balance?",
    })
  })

  test('pay routes with or without a receiver', () => {
    expect(routeComposerInput('pay')).toEqual({
      status: 'payment',
      amountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
    })
    expect(routeComposerInput(`pay 1.5 to ${FIXTURE_RECEIVER}`)).toEqual({
      status: 'payment',
      amountMicroAlgos: 1500000,
      to: FIXTURE_RECEIVER,
    })
  })
})

describe('payment parties', () => {
  const wallet = [{ address: FIXTURE_SENDER, name: 'alice' }]

  test('sample host pays fixture parties so a bare pay still demos', () => {
    expect(resolvePaymentParties({ live: false, accounts: [], activeAddress: undefined, to: undefined })).toEqual({
      sender: FIXTURE_SENDER,
      receiver: FIXTURE_RECEIVER,
    })
  })

  test('live without a wallet never drafts', () => {
    expect(
      resolvePaymentParties({ live: true, accounts: [], activeAddress: undefined, to: FIXTURE_RECEIVER }),
    ).toEqual({ error: 'connect a wallet to pay' })
  })

  test('live needs a named, checksum-valid receiver', () => {
    expect(resolvePaymentParties({ live: true, accounts: wallet, activeAddress: FIXTURE_SENDER, to: undefined })).toMatchObject({
      error: expect.stringContaining('Name the receiver'),
    })
    expect(resolvePaymentParties({ live: true, accounts: wallet, activeAddress: FIXTURE_SENDER, to: FIXTURE_RECEIVER })).toEqual({
      sender: FIXTURE_SENDER,
      receiver: FIXTURE_RECEIVER,
    })
    const badChecksum = `${FIXTURE_RECEIVER.slice(0, 57)}${FIXTURE_RECEIVER.endsWith('A') ? 'B' : 'A'}`
    expect(resolvePaymentParties({ live: true, accounts: wallet, activeAddress: FIXTURE_SENDER, to: badChecksum })).toMatchObject({
      error: expect.stringContaining('checksum'),
    })
    expect(resolvePaymentParties({ live: true, accounts: wallet, activeAddress: FIXTURE_SENDER, to: 'Alice' })).toEqual({
      sender: FIXTURE_SENDER,
      receiver: FIXTURE_SENDER,
    })
    expect(resolvePaymentParties({ live: true, accounts: wallet, activeAddress: FIXTURE_SENDER, to: 'carol' })).toMatchObject({
      error: expect.stringContaining('No connected account named'),
    })
  })
})
