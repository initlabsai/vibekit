import { describe, expect, test } from 'bun:test'

import {
  normalizeGroupId,
  parseEntityRef,
  resolveAddressByKey,
  resolveAssetByKey,
  resolveGroupByKey,
  resolveTransactionByKey,
  timeLabel,
  txnTypeLabel,
} from './entity-og'

describe('parseEntityRef', () => {
  test('one segment is a mainnet key', () => {
    expect(parseEntityRef(['12345'])).toEqual({ network: 'mainnet', key: '12345' })
  })

  test('a leading network segment names the network', () => {
    expect(parseEntityRef(['testnet', '12345'])).toEqual({ network: 'testnet', key: '12345' })
    expect(parseEntityRef(['localnet', 'ABC'])).toEqual({ network: 'localnet', key: 'ABC' })
  })

  test('junk shapes parse to nothing', () => {
    expect(parseEntityRef(undefined)).toBeUndefined()
    expect(parseEntityRef([])).toBeUndefined()
    expect(parseEntityRef(['devnet', '1'])).toBeUndefined()
    expect(parseEntityRef(['mainnet'])).toBeUndefined()
    expect(parseEntityRef(['a', 'b', 'c'])).toBeUndefined()
  })
})

describe('display helpers', () => {
  test('txn types map to labels, unknown ones pass through uppercased', () => {
    expect(txnTypeLabel('pay')).toBe('PAYMENT')
    expect(txnTypeLabel('axfer')).toBe('ASSET TRANSFER')
    expect(txnTypeLabel('weird')).toBe('WEIRD')
  })

  test('timeLabel renders a UTC minute', () => {
    expect(timeLabel(1700000000)).toBe('2023-11-14 22:13 UTC')
  })
})

describe('key validation', () => {
  test('a malformed txid is a short-lived miss without a network call', async () => {
    const resolution = await resolveTransactionByKey('mainnet', 'not-a-txid')
    expect(resolution.state).toBe('missing')
    expect(resolution.cacheControl).toContain('s-maxage=60')
  })

  test('a non-numeric asset key is a miss without a network call', async () => {
    expect((await resolveAssetByKey('mainnet', '12x45')).state).toBe('missing')
    expect((await resolveAssetByKey('mainnet', '')).state).toBe('missing')
  })

  test('group ids normalize from base64url or base64 to padded base64', () => {
    const b64 = 'Ab+cD/EfGhIjKlMnOpQrStUvWxYz0123456789abcde'
    const b64url = 'Ab-cD_EfGhIjKlMnOpQrStUvWxYz0123456789abcde'
    expect(normalizeGroupId(b64url)).toBe(`${b64}=`)
    expect(normalizeGroupId(`${b64}=`)).toBe(`${b64}=`)
    expect(normalizeGroupId('too-short')).toBeUndefined()
  })

  test('a malformed group key is a miss without a network call', async () => {
    expect((await resolveGroupByKey('mainnet', 'nope')).state).toBe('missing')
  })

  test('a bad-checksum address is a miss without a network call', async () => {
    expect((await resolveAddressByKey('mainnet', 'A'.repeat(58))).state).toBe('missing')
    expect((await resolveAddressByKey('mainnet', 'not-an-address')).state).toBe('missing')
  })
})
