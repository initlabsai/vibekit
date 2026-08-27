import { describe, expect, test } from 'bun:test'

import { transactionKind } from '../src/index.js'

const A = 'A'.repeat(58)
const B = 'B'.repeat(58)

describe('transactionKind', () => {
  test('names the idioms a bare type undersells', () => {
    expect(
      transactionKind({
        type: 'pay',
        sender: A,
        receiver: B,
        paymentAmountMicroAlgos: 0,
        rekeyTo: B,
      }),
    ).toBe('rekey')
    expect(transactionKind({ type: 'axfer', sender: A, receiver: A, assetAmount: 0 })).toBe(
      'assetOptIn',
    )
    expect(
      transactionKind({ type: 'axfer', sender: A, receiver: B, assetAmount: 5, clawbackFrom: B }),
    ).toBe('clawback')
    expect(
      transactionKind({ type: 'appl', sender: A, applicationId: 0, createdApplicationId: 9 }),
    ).toBe('appCreate')
    expect(transactionKind({ type: 'acfg', sender: A, assetId: 0, createdAssetId: 4 })).toBe(
      'assetCreate',
    )
  })

  test('says nothing when the type already does', () => {
    expect(
      transactionKind({
        type: 'pay',
        sender: A,
        receiver: B,
        paymentAmountMicroAlgos: 5,
        rekeyTo: B,
      }),
    ).toBeUndefined()
    expect(
      transactionKind({ type: 'axfer', sender: A, receiver: A, assetAmount: 0, closeTo: B }),
    ).toBeUndefined()
    expect(transactionKind({ type: 'appl', sender: A, applicationId: 7 })).toBeUndefined()
    expect(transactionKind({ type: 'keyreg', sender: A })).toBeUndefined()
  })
})
