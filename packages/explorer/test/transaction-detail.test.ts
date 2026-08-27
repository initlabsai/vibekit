import { describe, expect, test } from 'bun:test'

import { buildTransactionDetailRecord, transactionDetailDataSchema } from '../src/index.js'

const SENDER = 'L2MGM6VDPH7HME2IVMKLUYCLH5HWSZY7RQIMD5UCCTFNJ4M4DCBRXPSFJE'
const APP_ADDR = 'WPR5O4HW43WM3R3RIGE7XT5QH3TSNER4VYJIGIT2CGS2SKX7P2Y724JCSQ'

describe('transaction.detail records', () => {
  test('keep raw app-call evidence: args, logs, state deltas, inner rows', () => {
    const record = buildTransactionDetailRecord(
      { resultId: 'r-appl', toolCallId: 'c-appl', network: 'localnet' },
      {
        id: 'XSFDXI4LEWSNF2HVVUVZPS5O75GJNRNGXAD2PBVWIXLAXFUONHZA',
        type: 'appl',
        sender: SENDER,
        feeMicroAlgos: 1000,
        confirmedRound: 230,
        applicationId: 1242,
        onCompletion: 'noop',
        applicationArgs: ['Ar7OEQ==', 'AAVXb3JsZA=='],
        logs: ['FR98dQAMSGVsbG8sIFdvcmxk'],
        globalStateDelta: [{ key: 'dmFsdWU=', value: { action: 2, uint: 1 } }],
        innerTxns: [
          {
            type: 'pay',
            sender: APP_ADDR,
            receiver: SENDER,
            paymentAmountMicroAlgos: 5,
            feeMicroAlgos: 0,
            innerTxns: [{ type: 'pay', sender: APP_ADDR, receiver: SENDER, feeMicroAlgos: 0 }],
          },
        ],
      },
    )
    if (record.state !== 'success') throw new Error(record.error.message)
    const data = transactionDetailDataSchema.parse(record.data)
    expect(data.applicationArgs).toHaveLength(2)
    expect(data.logs?.[0]?.startsWith('FR98dQ')).toBe(true)
    expect(data.globalStateDelta?.[0]?.value.uint).toBe(1)
    expect(data.innerCount).toBe(1)
    expect(data.innerTxns?.[0]).toMatchObject({ sender: APP_ADDR, innerCount: 1 })
  })
})
