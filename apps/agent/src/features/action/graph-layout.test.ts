import { describe, expect, test } from 'bun:test'

import { buildTransactionsGraph } from '@initlabs/vibekit/views'
import { PAYMENT_FIXTURE_AMOUNT_MICROALGOS } from '@initlabs/vibekit/views/sample'

import { endTag, layoutGraph, MAX_LANE, MIN_LANE, PAD_X } from './graph-layout.js'

const A = 'WPR5O4HW43WM3R3RIGE7XT5QH3TSNER4VYJIGIT2CGS2SKX7P2Y724JCSQ'
const B = 'L2MGM6VDPH7HME2IVMKLUYCLH5HWSZY7RQIMD5UCCTFNJ4M4DCBRXPSFJE'
const pay = (sender: string, receiver: string) => ({ type: 'pay', sender, receiver, paymentAmountMicroAlgos: PAYMENT_FIXTURE_AMOUNT_MICROALGOS, feeMicroAlgos: 1000 })

describe('flow graph geometry', () => {
  test('lanes fill the width between the limits; lifelines sit at the lane centers', () => {
    const graph = buildTransactionsGraph([pay(A, B)])
    const wide = layoutGraph(graph, 2000, () => 'pay')
    expect(wide.lane).toBe(MAX_LANE)
    expect(wide.centers).toEqual([PAD_X, PAD_X + MAX_LANE])
    const narrow = layoutGraph(graph, 200, () => 'pay')
    expect(narrow.lane).toBe(MIN_LANE)
    expect(narrow.width).toBeGreaterThan(200)
  })

  test('a payment is a vector from the sender to the receiver; a return trip points left', () => {
    const graph = buildTransactionsGraph([pay(A, B), pay(B, A)])
    const { rows } = layoutGraph(graph, 1000, () => '0.25 ALGO')
    const [out, back] = rows
    if (out?.kind !== 'vector' || back?.kind !== 'vector') throw new Error('expected vectors')
    expect(out.dir).toBe('right')
    expect(out.origin).toBeLessThan(out.target)
    expect(back.dir).toBe('left')
    expect(back.origin).toBeGreaterThan(back.target)
    expect(back.y - out.y).toBe(40)
  })

  test('a self-payment is a loop; a long caption moves above the line', () => {
    const graph = buildTransactionsGraph([pay(A, A)])
    const { rows } = layoutGraph(graph, 1000, () => 'x')
    expect(rows[0]?.kind).toBe('selfLoop')
    const long = layoutGraph(buildTransactionsGraph([pay(A, B)]), 400, () => 'a'.repeat(60))
    expect(long.rows[0]?.kind === 'vector' && long.rows[0].captionInline).toBe(false)
  })

  test('an end tag that repeats its own column says nothing', () => {
    const account = { type: 'account' as const, address: A, accountNumber: 1, associatedAccounts: [] }
    expect(endTag(account, 1)).toBe('')
    expect(endTag(account, 2)).toBe('(2)')
    expect(endTag(account, 'rekey')).toBe('(rk)')
  })
})
