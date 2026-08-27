import { describe, expect, test } from 'bun:test'

import algosdk from 'algosdk'

import { resolveRemoveTarget } from '../src/commands/keystore.js'

/** The zero address: valid, and held by nobody. */
const ZERO = algosdk.encodeAddress(new Uint8Array(32))
const alice = { address: 'ALICE' + 'A'.repeat(53), name: 'alice' }
const bob = { address: 'BOB' + 'B'.repeat(55), name: 'bob' }

describe('resolveRemoveTarget', () => {
  test('an address or a unique name names the account', () => {
    expect(resolveRemoveTarget([alice, bob], 'alice')).toEqual({ kind: 'account', account: alice })
    expect(resolveRemoveTarget([alice, bob], bob.address)).toEqual({
      kind: 'account',
      account: bob,
    })
  })

  test('a name held by two accounts is ambiguous', () => {
    const twin = { address: 'TWIN' + 'T'.repeat(54), name: 'alice' }
    expect(resolveRemoveTarget([alice, twin], 'alice')).toEqual({
      kind: 'ambiguous',
      matches: [alice, twin],
    })
  })

  test('a valid address the daemon lacks is a miss; anything else is a raw key id', () => {
    expect(resolveRemoveTarget([alice], ZERO).kind).toBe('unknown-address')
    expect(resolveRemoveTarget([alice], 'key-7').kind).toBe('key-id')
  })
})
