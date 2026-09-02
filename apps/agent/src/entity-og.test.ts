import { describe, expect, test } from 'bun:test'

import {
  parseEntityRef,
  resolveAssetByKey,
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
})
