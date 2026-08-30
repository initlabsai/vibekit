/** Every component renders from its tool-output type alone; here, with static markup. */
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { Account } from './account'
import { ActionApproval } from './action-approval'
import { Asset, AssetList } from './asset'
import { Companion } from './companion'
import { ToolResult } from './tool-result'
import { Transaction, transactionHeadline } from './transaction'
import { formatBaseUnits, formatMicroAlgos, shorten } from './format'

const ADDR = 'WPR5O4HW43WM3R3RIGE7XT5QH3TSNER4VYJIGIT2CGS2SKX7P2Y724JCSQ'
const OTHER = 'L2MGM6VDPH7HME2IVMKLUYCLH5HWSZY7RQIMD5UCCTFNJ4M4DCBRXPSFJE'

describe('format', () => {
  test('digit math, never floats', () => {
    expect(formatMicroAlgos(250_000)).toBe('0.25')
    expect(formatMicroAlgos('-1000')).toBe('-0.001')
    expect(formatBaseUnits('123456789012345678901', 6)).toBe('123,456,789,012,345.678901')
    expect(shorten(ADDR)).toBe('WPR5O…4JCSQ')
  })
})

describe('components', () => {
  test('Transaction: payment headline, facts, shortened addresses', () => {
    const html = renderToStaticMarkup(<Transaction transaction={{ id: 'TXID', type: 'pay', sender: ADDR, receiver: OTHER, feeMicroAlgos: 1000, paymentAmountMicroAlgos: 250_000, confirmedRound: 22, note: 'hi' }} />)
    expect(html).toContain('0.25 ALGO')
    expect(html).toContain('WPR5O…4JCSQ')
    expect(html).toContain('<dt>round</dt><dd title="22">22</dd>')
    expect(transactionHeadline({ sender: ADDR, feeMicroAlgos: 1000, assetId: 31566704, assetAmount: '1500000', assetDecimals: 6, assetUnitName: 'USDC' })).toBe('1.5 USDC')
    expect(transactionHeadline({ sender: ADDR, feeMicroAlgos: 1000, applicationId: 7, methodName: 'swap' })).toBe('swap · app 7')
  })

  test('Asset and AssetList: scaled supply is what shows', () => {
    const usdc = { assetId: 31566704, name: 'USDC', unitName: 'USDC', totalSupply: '18446744073709551615', totalSupplyScaled: '18,446,744,073,709.551615', totalSupplyApprox: '≈18 trillion', decimals: 6, creator: ADDR }
    expect(renderToStaticMarkup(<Asset asset={usdc} />)).toContain('18,446,744,073,709.551615 (≈18 trillion)')
    const list = renderToStaticMarkup(<AssetList assets={[usdc]} onOpen={() => {}} />)
    expect(list).toContain('<td>31566704</td>')
    expect(list).toContain('vk-row-open')
  })

  test('Account: balance hero, counts pluralised, rekey flagged', () => {
    const html = renderToStaticMarkup(<Account account={{ address: ADDR, balanceMicroAlgos: 1_500_000, totalAssetsOptedIn: 1, totalAppsOptedIn: 2, rekeyedTo: OTHER }} />)
    expect(html).toContain('1.5 ALGO')
    expect(html).toContain('1 holding')
    expect(html).toContain('2 opt-ins')
    expect(html).toContain('vk-account-rekeyed')
  })

  test('ActionApproval: a payment, a failed simulation, a swap intent', () => {
    const draft = { sender: ADDR, receiver: OTHER, amountMicroAlgos: 250_000, feeMicroAlgos: 1000, transactionTypes: ['pay'], unsignedGroup: { transactions: ['AAAA'], summary: 'pay 0.25 ALGO' } }
    const ok = renderToStaticMarkup(<ActionApproval draft={draft} network="testnet" onApprove={() => {}} onDeny={() => {}} />)
    expect(ok).toContain('0.25 ALGO')
    expect(ok).not.toContain('vk-approval-danger')
    const failed = renderToStaticMarkup(
      <ActionApproval draft={draft} network="mainnet" onApprove={() => {}} onDeny={() => {}} simulation={{ wouldSucceed: false, failureMessage: 'overspend', sender: ADDR, feeMicroAlgos: 1000, group: { size: 1, transactionTypes: ['pay'] }, effects: [{ account: ADDR, deltaMicroAlgos: -251_000 }], simulatedRound: 1 }} />,
    )
    expect(failed).toContain('vk-approval-danger')
    expect(failed).toContain('overspend')
    expect(failed).toMatch(/approve<\/button>/)
    expect(failed).toContain('disabled=""')
    const swap = renderToStaticMarkup(
      <ActionApproval network="mainnet" onApprove={() => {}} onDeny={() => {}} draft={{ ...draft, receiver: undefined, amountMicroAlgos: undefined, unsignedGroup: { transactions: ['A', 'B'], summary: 'swap' }, presigned: ['sig', null], intent: { kind: 'swap', fromAssetId: 0, toAssetId: 31566704, fromUnit: 'ALGO', toUnit: 'USDC', fromDecimals: 6, toDecimals: 6, amountIn: '10000000', amountOut: '2310000', minAmountOut: '2286900', slippagePercent: 1, route: [{ venue: 'Pact', percentage: 100 }] } }} />,
    )
    expect(swap).toContain('10 ALGO → 2.31 USDC')
    expect(swap).toContain('2 transactions, 1 pre-signed')
  })

  test('ToolResult: JSON, or the error', () => {
    expect(renderToStaticMarkup(<ToolResult toolName="lookup_asset" output={{ a: 1 }} isError={false} />)).toContain('&quot;a&quot;: 1')
    expect(renderToStaticMarkup(<ToolResult toolName="x" output={{ error: { code: 'RATE_LIMITED', message: 'resting' } }} isError />)).toContain('<code>RATE_LIMITED</code> resting')
  })

  test('Companion: step indexes the mood', () => {
    const faces = { calm: ['a', 'b'], working: ['x', 'y', 'z'] }
    expect(renderToStaticMarkup(<Companion mood="working" step={4} faces={faces} />)).toContain('>y<')
    expect(renderToStaticMarkup(<Companion mood="calm" step={0} faces={faces} still />)).toContain('companion-still')
  })
})
