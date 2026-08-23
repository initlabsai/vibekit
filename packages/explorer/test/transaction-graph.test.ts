import { describe, expect, test } from 'bun:test'
import { getApplicationAddress } from 'algosdk'

import {
  buildTransactionsGraph,
  type GraphHorizontal,
  type GraphTransaction,
  type TransactionsGraph,
} from '../src/index.js'
import { buildTransactionGroupRecord } from '../src/views/transaction.js'
// Naming note: transactions are mainnet; each group entry carries its own
// `network` (two of Lora's snapshot groups only exist on testnet).
import corpus from './recorded/mainnet-graph-corpus.json'

const appAddressFor = (applicationId: number) => getApplicationAddress(applicationId).toString()

const transactions = corpus.transactions as unknown as Record<string, GraphTransaction>
const groups = corpus.groups as unknown as Record<
  string,
  { network: string; transactions: GraphTransaction[] }
>

const recordings: [string, GraphTransaction[]][] = [
  ...Object.entries(transactions).map(([id, txn]): [string, GraphTransaction[]] => [id, [txn]]),
  ...Object.entries(groups).map(([id, group]): [string, GraphTransaction[]] => [id, group.transactions]),
]

// Escrow addresses recorded from algosdk getApplicationAddress for the corpus apps.
const ESCROWS = {
  1201559522: 'GEAW6VVQY2QPYKEI6HAHAH3MNQNMXYOVKYVVI3B7X72CPW74HRVYXWGITU',
  1002541853: 'XSKED5VKZZCSYNDWXZJI65JM2HP7HZFJWCOBIMOONKHTK5UVKENBNVDEYM',
  645869114: 'IWT4WOUKYQBCAO76UKWZ5E4CPIJVLBE5R3NX5QH3BXMTG34WU7ZCLJ4RVY',
  971368268: '2ZPNLKXWCOUJ2ONYWZEIWOUYRXL36VCIBGJ4ZJ2AAGET5SIRTHKSNFDJJ4',
  971350278: 'NOENFBPVMK24RFZDGE3ID4CJI3RT6PQ6JFJPKKKBA4EOHVVEEQF3Y2BZJI',
  1800533232: 'EG4G4PRHTEGUQJSLOBAQFIGOBJGTSEIFESANL7V6HJ3JYUXBXZ76QPKT5A',
  2365972864: 'BPNOT3ZSQYVEKXD6ZGE76TLFTZRPMLUCODNH4RXJOPNMRCDWIYPW76IJ3M',
  3679982959: 'WT3P37OKCYY7VD3NKJOMW6VZLZRPHOBRJHCMOMKX6HZUFZZVALRUXQV5AA',
} as const

function verticalIndexes(row: GraphHorizontal): number[] {
  const rep = row.representation
  return rep.kind === 'vector' ? [rep.fromVertical, rep.toVertical] : [rep.vertical]
}

/** Expected (depth, isRemainder) row sequence per the wire's innerTxns nesting. */
function expectedRowShape(txns: GraphTransaction[], depth = 0): { depth: number; isRemainder: boolean }[] {
  return txns.flatMap((txn) => {
    const rows = [{ depth, isRemainder: false }]
    if ((txn.type === 'pay' || txn.type === 'axfer') && txn.closeTo !== undefined) {
      rows.push({ depth, isRemainder: true })
    }
    if (txn.type === 'appl') rows.push(...expectedRowShape(txn.innerTxns ?? [], depth + 1))
    return rows
  })
}

/** All (address, accountNumber) claims a graph makes, across every vertical facet. */
function accountNumberClaims(graph: TransactionsGraph): [string, number][] {
  return graph.verticals.flatMap((vertical): [string, number][] => {
    if (vertical.type === 'account') {
      return [
        [vertical.address, vertical.accountNumber],
        ...vertical.associatedAccounts.map((a): [string, number] => [a.address, a.accountNumber]),
      ]
    }
    if (vertical.type === 'application') {
      return [
        ...(vertical.linkedAccount
          ? [[vertical.linkedAccount.address, vertical.linkedAccount.accountNumber] as [string, number]]
          : []),
        ...vertical.associatedAccounts.map((a): [string, number] => [a.address, a.accountNumber]),
      ]
    }
    return []
  })
}

describe('transaction graph structural invariants', () => {
  for (const [id, txns] of recordings) {
    test(`${id.slice(0, 12)} builds a coherent graph`, () => {
      const graph = buildTransactionsGraph(txns, { appAddressFor })

      // Every representation references valid vertical indexes; vectors normalized.
      for (const row of graph.horizontals) {
        for (const index of verticalIndexes(row)) {
          expect(index).toBeGreaterThanOrEqual(0)
          expect(index).toBeLessThan(graph.verticals.length)
        }
        if (row.representation.kind === 'vector') {
          expect(row.representation.fromVertical).toBeLessThan(row.representation.toVertical)
        }
      }

      // Depth-first row order matches innerTxns nesting, remainder sub-rows included.
      expect(
        graph.horizontals.map((row) => ({ depth: row.depth, isRemainder: row.isRemainder })),
      ).toEqual(expectedRowShape(txns))

      // Ancestor chains: one app-call ancestor per depth level, indexes preceding the row.
      graph.horizontals.forEach((row, rowIndex) => {
        expect(row.ancestors).toHaveLength(row.depth)
        for (const ancestor of row.ancestors) {
          expect(ancestor).toBeLessThan(rowIndex)
          const ancestorRow = graph.horizontals[ancestor]!
          expect(['appCall', 'appCreate', 'appUpdate']).toContain(ancestorRow.label.type)
        }
      })

      // accountNumbers: 1-based, contiguous, and consistent per address.
      const claims = accountNumberClaims(graph)
      const byAddress = new Map<string, number>()
      for (const [address, accountNumber] of claims) {
        expect(byAddress.get(address) ?? accountNumber).toBe(accountNumber)
        byAddress.set(address, accountNumber)
      }
      const numbers = [...new Set(byAddress.values())].sort((a, b) => a - b)
      expect(numbers).toEqual(numbers.map((_, i) => i + 1))

      // Dedupe: one column per entity.
      const accountAddresses = graph.verticals.flatMap((v) => (v.type === 'account' ? [v.address] : []))
      expect(new Set(accountAddresses).size).toBe(accountAddresses.length)
      const escrowAddresses = graph.verticals.flatMap((v) =>
        v.type === 'application' && v.linkedAccount ? [v.linkedAccount.address] : [],
      )
      for (const escrow of escrowAddresses) expect(accountAddresses).not.toContain(escrow)
      const applicationIds = graph.verticals.flatMap((v) => (v.type === 'application' ? [v.applicationId] : []))
      expect(new Set(applicationIds).size).toBe(applicationIds.length)
      const assetIds = graph.verticals.flatMap((v) => (v.type === 'asset' ? [v.assetId] : []))
      expect(new Set(assetIds).size).toBe(assetIds.length)
      expect(graph.verticals.filter((v) => v.type === 'opUp').length).toBeLessThanOrEqual(1)
    })
  }

  test('an empty group builds an empty graph', () => {
    expect(buildTransactionsGraph([], { appAddressFor })).toEqual({ verticals: [], horizontals: [] })
  })
})

describe('hand-verified against algokit-lora snapshots', () => {
  // Expected structure read from Lora's rendered snapshot
  // asset-transfer-graph.563MNGEL2OF4IBA7CFLIJNMBETT5QNKZURSLIONJBTJFALGYOAUA.html:
  // a single account column (SMO6…ALKU, badge 1) and one "Transfer 0 USDt"
  // self-loop row. Lora's trailing Placeholder spacer column is not modeled.
  test('563MNGEL: asset opt-in self transfer', () => {
    const txn = transactions['563MNGEL2OF4IBA7CFLIJNMBETT5QNKZURSLIONJBTJFALGYOAUA']!
    const graph = buildTransactionsGraph([txn], { appAddressFor })

    expect(graph.verticals).toEqual([
      { type: 'account', address: txn.sender, accountNumber: 1, associatedAccounts: [] },
    ])
    expect(graph.horizontals).toEqual([
      {
        representation: { kind: 'selfLoop', vertical: 0, fromTag: 1, toTag: 1 },
        label: { type: 'assetOptIn', assetAmount: 0, assetId: 312769, assetDecimals: 6, assetUnitName: 'USDt' },
        depth: 0,
        ancestors: [],
        isRemainder: false,
        hasNextSibling: false,
        transactionId: txn.id!,
      },
    ])
  })

  // Expected structure read from Lora's rendered snapshot
  // asset-transfer-graph.JBDSQEI37W5KWPQICT2IGCG2FWMUGJEUYYK3KFKNSYRNAXU2ARUA.html:
  // two account columns (badges 1, 2) and one "Transfer 0.3 AKTA" vector.
  // Deliberate deviation: the wire carries auth-addr (signer != sender), so the
  // sender endpoint is rekey-tagged; Lora's snapshot renders a plain badge 1.
  test('JBDSQEI: plain asset transfer from a rekeyed sender', () => {
    const txn = transactions['JBDSQEI37W5KWPQICT2IGCG2FWMUGJEUYYK3KFKNSYRNAXU2ARUA']!
    const graph = buildTransactionsGraph([txn], { appAddressFor })

    expect(txn.signer).toBeDefined()
    expect(graph.verticals.map((v) => v.type)).toEqual(['account', 'account'])
    expect(graph.horizontals).toHaveLength(1)
    expect(graph.horizontals[0]!.representation).toEqual({
      kind: 'vector',
      fromVertical: 0,
      toVertical: 1,
      direction: 'leftToRight',
      fromTag: 'rekey',
      toTag: 2,
    })
    expect(graph.horizontals[0]!.label).toEqual({
      type: 'assetTransfer',
      assetAmount: 300000,
      assetId: 523683256,
      assetDecimals: 6,
      assetUnitName: 'AKTA',
    })
  })

  // Expected structure read from Lora's rendered snapshot
  // application-transaction-graph.GYZT5MEYJKR35U7CL3NUFCJVSAWBOQITRB3S5IQS2TWBZPD7E34A.html:
  // columns Y44J…SVPQ(1) | app 1800533232 linked EG4G…KT5A(2) | AAAA…HFKQ(3) |
  // PZNG…4XTY(4); rows App Call, Transfer 0 (2→3), Remainder 1 (→1), Payment 0.1 (→4).
  test('GYZT: app call with close-out remainder sub-row', () => {
    const txn = transactions['GYZT5MEYJKR35U7CL3NUFCJVSAWBOQITRB3S5IQS2TWBZPD7E34A']!
    const graph = buildTransactionsGraph([txn], { appAddressFor })

    expect(graph.verticals).toEqual([
      { type: 'account', address: txn.sender, accountNumber: 1, associatedAccounts: [] },
      {
        type: 'application',
        applicationId: 1800533232,
        linkedAccount: { address: ESCROWS[1800533232], accountNumber: 2 },
        associatedAccounts: [],
      },
      {
        type: 'account',
        address: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
        accountNumber: 3,
        associatedAccounts: [],
      },
      {
        type: 'account',
        address: 'PZNGYF4Y25GGO674BW4CRDHFKOKHMHZXSFXIKMYPEJCQAUTDH52WV24XTY',
        accountNumber: 4,
        associatedAccounts: [],
      },
    ])

    expect(graph.horizontals).toHaveLength(4)
    const [appCall, transfer, remainder, payment] = graph.horizontals
    expect(appCall!.label.type).toBe('appCall')
    // Deviation from the snapshot's badge 1: the wire carries auth-addr, so
    // the rekeyed sender endpoint is rekey-tagged.
    expect(appCall!.representation).toEqual({
      kind: 'vector',
      fromVertical: 0,
      toVertical: 1,
      direction: 'leftToRight',
      fromTag: 'rekey',
    })

    expect(transfer!.label).toEqual({ type: 'assetTransfer', assetAmount: 0, assetId: 847594689 })
    expect(transfer!.representation).toEqual({
      kind: 'vector',
      fromVertical: 1,
      toVertical: 2,
      direction: 'leftToRight',
      fromTag: 2,
      toTag: 3,
    })
    expect(transfer!.depth).toBe(1)
    expect(transfer!.ancestors).toEqual([0])

    // The close-out remainder is its own sub-row back to the close-to account;
    // fromTag stays the sender-side tag after index normalization.
    expect(remainder!.isRemainder).toBe(true)
    expect(remainder!.label).toEqual({ type: 'assetTransferRemainder', assetAmount: 1, assetId: 847594689 })
    expect(remainder!.representation).toEqual({
      kind: 'vector',
      fromVertical: 0,
      toVertical: 1,
      direction: 'rightToLeft',
      fromTag: 2,
      toTag: 1,
    })

    expect(payment!.label).toEqual({ type: 'payment', amountMicroAlgos: 100000 })
    expect(payment!.representation).toEqual({
      kind: 'vector',
      fromVertical: 1,
      toVertical: 3,
      direction: 'leftToRight',
      fromTag: 2,
      toTag: 4,
    })
  })

  // Expected structure read from Lora's rendered snapshot
  // application-transaction-graph.KMNBSQ4ZFX252G7S4VYR4ZDZ3RXIET5CNYQVJUO5OXXPMHAMJCCQ.html:
  // columns W2IZ…NCEY(1) | app 971368268 linked 2ZPN…DJJ4(2) | app 971350278
  // linked NOEN…BZJI(3); rows App Call, Payment ≈237 (2→1), App Call (2→3).
  test('KMNB: app call whose escrow pays out and calls another app', () => {
    const txn = transactions['KMNBSQ4ZFX252G7S4VYR4ZDZ3RXIET5CNYQVJUO5OXXPMHAMJCCQ']!
    const graph = buildTransactionsGraph([txn], { appAddressFor })

    expect(graph.verticals).toEqual([
      { type: 'account', address: txn.sender, accountNumber: 1, associatedAccounts: [] },
      {
        type: 'application',
        applicationId: 971368268,
        linkedAccount: { address: ESCROWS[971368268], accountNumber: 2 },
        associatedAccounts: [],
      },
      {
        type: 'application',
        applicationId: 971350278,
        linkedAccount: { address: ESCROWS[971350278], accountNumber: 3 },
        associatedAccounts: [],
      },
    ])

    expect(graph.horizontals.map((row) => row.label.type)).toEqual(['appCall', 'payment', 'appCall'])
    const [, payment, innerCall] = graph.horizontals
    expect(payment!.label.amountMicroAlgos).toBe(236706032)
    expect(payment!.representation).toEqual({
      kind: 'vector',
      fromVertical: 0,
      toVertical: 1,
      direction: 'rightToLeft',
      fromTag: 2,
      toTag: 1,
    })
    expect(innerCall!.representation).toEqual({
      kind: 'vector',
      fromVertical: 1,
      toVertical: 2,
      direction: 'leftToRight',
      fromTag: 2,
    })
  })
})

describe('single transaction with nested inners', () => {
  // Expected structure read from Lora's rendered snapshot
  // application-transaction-graph.INDQXWQXHF22SO45EZY7V6FFNI6WUD5FHRVDV6NCU6HD424BJGGA.html:
  // columns AACC(1) | app 1201559522 linked GEAW(2) rekey AACC | 2PIF(3) |
  // app 1002541853 linked XSKE(4) rekeys 2PIF/FCHE/EOXL | FCHE(5) | EOXL(6) |
  // app 645869114 linked IWT4(7); 14 rows, depth-first.
  test('INDQ: three-hop swap graph from one root transaction', () => {
    const txn = transactions['INDQXWQXHF22SO45EZY7V6FFNI6WUD5FHRVDV6NCU6HD424BJGGA']!
    const graph = buildTransactionsGraph([txn], { appAddressFor })

    const sender = txn.sender
    expect(graph.verticals).toEqual([
      { type: 'account', address: sender, accountNumber: 1, associatedAccounts: [] },
      {
        type: 'application',
        applicationId: 1201559522,
        linkedAccount: { address: ESCROWS[1201559522], accountNumber: 2 },
        associatedAccounts: [{ kind: 'rekey', address: sender, accountNumber: 1 }],
      },
      {
        type: 'account',
        address: '2PIFZW53RHCSFSYMCFUBW4XOCXOMB7XOYQSQ6KGT3KVGJTL4HM6COZRNMM',
        accountNumber: 3,
        associatedAccounts: [],
      },
      {
        type: 'application',
        applicationId: 1002541853,
        linkedAccount: { address: ESCROWS[1002541853], accountNumber: 4 },
        associatedAccounts: [
          { kind: 'rekey', address: '2PIFZW53RHCSFSYMCFUBW4XOCXOMB7XOYQSQ6KGT3KVGJTL4HM6COZRNMM', accountNumber: 3 },
          { kind: 'rekey', address: 'FCHEP67BCAA64RTZZNHLOUJF22TDWPWKSWO4FDRLLHC3NMKCCMRCKPIYSM', accountNumber: 5 },
          { kind: 'rekey', address: 'EOXLRDMDV4Y7GEWY5GEDCIJV7SQM3A3TBHYAPBTWHS7JTOOYHZXPUEGCE4', accountNumber: 6 },
        ],
      },
      {
        type: 'account',
        address: 'FCHEP67BCAA64RTZZNHLOUJF22TDWPWKSWO4FDRLLHC3NMKCCMRCKPIYSM',
        accountNumber: 5,
        associatedAccounts: [],
      },
      {
        type: 'account',
        address: 'EOXLRDMDV4Y7GEWY5GEDCIJV7SQM3A3TBHYAPBTWHS7JTOOYHZXPUEGCE4',
        accountNumber: 6,
        associatedAccounts: [],
      },
      {
        type: 'application',
        applicationId: 645869114,
        linkedAccount: { address: ESCROWS[645869114], accountNumber: 7 },
        associatedAccounts: [],
      },
    ])

    expect(graph.horizontals).toHaveLength(14)
    expect(graph.horizontals.map((row) => row.depth)).toEqual([0, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1])

    const rows = graph.horizontals
    expect(rows[0]!.representation).toEqual({
      kind: 'vector',
      fromVertical: 0,
      toVertical: 1,
      direction: 'leftToRight',
      fromTag: 1,
    })
    expect(rows[0]!.transactionId).toBe(txn.id!)

    // inner/1: the root sender acts through the app, so its edge is rekey-tagged.
    expect(rows[1]!.label).toEqual({ type: 'payment', amountMicroAlgos: 2770045 })
    expect(rows[1]!.representation).toEqual({
      kind: 'vector',
      fromVertical: 0,
      toVertical: 2,
      direction: 'leftToRight',
      fromTag: 'rekey',
      toTag: 3,
    })

    // inner/2/1: pool account sends back to the root sender, rekey-tagged at depth 2.
    expect(rows[3]!.representation).toEqual({
      kind: 'vector',
      fromVertical: 0,
      toVertical: 2,
      direction: 'rightToLeft',
      fromTag: 'rekey',
      toTag: 1,
    })
    expect(rows[3]!.ancestors).toEqual([0, 2])

    // inner/8/1: the V1 app's own escrow pays the sender, tagged 7 → 1.
    expect(rows[12]!.label).toEqual({ type: 'payment', amountMicroAlgos: 2786260 })
    expect(rows[12]!.representation).toEqual({
      kind: 'vector',
      fromVertical: 0,
      toVertical: 6,
      direction: 'rightToLeft',
      fromTag: 7,
      toTag: 1,
    })
    expect(rows[12]!.ancestors).toEqual([0, 11])

    // inner/9: self-payment (rekey back) is a self loop on the sender column.
    expect(rows[13]!.representation).toEqual({ kind: 'selfLoop', vertical: 0, fromTag: 'rekey', toTag: 1 })
    expect(rows[13]!.label).toEqual({ type: 'payment', amountMicroAlgos: 0 })
  })

  // Verified against Lora's rendered snapshot
  // group-graph.wDegGrdXE32WoxPfioFELwPVWBIiZK0GF1bwos7fJs0%3D.html: the inner
  // app create resolves to Lora's app 2365972864 via createdApplicationId.
  // Deviation: Lora draws the created app's escrow BPNO…IJ3M(3) as its own
  // account column beside the app column; we merge one entity into one column.
  test('wDegGrdX group: inner app create resolved to its created id', () => {
    const group = groups['wDegGrdXE32WoxPfioFELwPVWBIiZK0GF1bwos7fJs0=']!
    const graph = buildTransactionsGraph(group.transactions, { appAddressFor })

    expect(graph.verticals.map((v) => v.type)).toEqual(['account', 'application', 'application'])
    const [, outerApp, createdApp] = graph.verticals
    expect(outerApp).toMatchObject({
      applicationId: 2174001591,
      linkedAccount: { accountNumber: 2 },
      associatedAccounts: [{ kind: 'rekey', address: ESCROWS[2365972864], accountNumber: 3 }],
    })
    expect(createdApp).toMatchObject({
      applicationId: 2365972864,
      linkedAccount: { address: ESCROWS[2365972864], accountNumber: 3 },
    })

    expect(graph.horizontals.map((row) => row.label.type)).toEqual([
      'payment',
      'appCall',
      'appCreate',
      'payment',
      'payment',
      'assetOptIn',
    ])
    // The funding payment lands on the outer app's escrow column.
    expect(graph.horizontals[0]!.representation).toEqual({
      kind: 'vector',
      fromVertical: 0,
      toVertical: 1,
      direction: 'leftToRight',
      fromTag: 1,
      toTag: 2,
    })
    // The create row runs from the outer app to the created app's column.
    expect(graph.horizontals[2]!.representation).toEqual({
      kind: 'vector',
      fromVertical: 1,
      toVertical: 2,
      direction: 'leftToRight',
      fromTag: 2,
    })
    expect(graph.horizontals[2]!.ancestors).toEqual([1])
    // The created app's own inner self-payment loops on its column, badge-tagged
    // (its sender IS the created app's escrow, matching Lora's "3 Payment 0").
    expect(graph.horizontals[3]!.representation).toEqual({
      kind: 'selfLoop',
      vertical: 2,
      fromTag: 3,
      toTag: 3,
    })
    expect(graph.horizontals[3]!.ancestors).toEqual([1, 2])
    // The escrow's opt-in under the outer app stays rekey-tagged (its sender
    // is not the outer app's escrow).
    expect(graph.horizontals[5]!.representation).toEqual({
      kind: 'selfLoop',
      vertical: 2,
      fromTag: 'rekey',
      toTag: 3,
    })
  })
})

describe('created ids, freezes, and asset configs', () => {
  const SENDER = 'ACFGSENDERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  const TARGET = 'FREEZETARGETAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  const base = { sender: SENDER, feeMicroAlgos: 1000 } as const

  // Recorded mainnet app create: the row lands on the application column for
  // the indexer's created-application-index, not a column for application 0,
  // and the rekeyed signer (auth-addr) tags the sender endpoint.
  test('5VJZ: recorded app create resolves the created application id', () => {
    const txn = transactions['5VJZGNPXIFV4CW5TPJ6P2QSNF3TEMF4T5XDHPIPUOAICD6IGUIGQ']!
    const graph = buildTransactionsGraph([txn], { appAddressFor })

    expect(graph.verticals).toEqual([
      { type: 'account', address: txn.sender, accountNumber: 1, associatedAccounts: [] },
      {
        type: 'application',
        applicationId: 3679982959,
        linkedAccount: { address: ESCROWS[3679982959], accountNumber: 2 },
        associatedAccounts: [],
      },
    ])
    expect(graph.horizontals).toHaveLength(1)
    expect(graph.horizontals[0]!.label).toEqual({ type: 'appCreate' })
    expect(graph.horizontals[0]!.representation).toEqual({
      kind: 'vector',
      fromVertical: 0,
      toVertical: 1,
      direction: 'leftToRight',
      fromTag: 'rekey',
    })
  })

  test('afrz draws a sender → frozen-account vector with the asset in the label', () => {
    const graph = buildTransactionsGraph(
      [{ ...base, type: 'afrz', assetId: 4321, freezeTarget: TARGET, frozen: true }],
      { appAddressFor },
    )

    expect(graph.verticals).toEqual([
      { type: 'account', address: SENDER, accountNumber: 1, associatedAccounts: [] },
      { type: 'account', address: TARGET, accountNumber: 2, associatedAccounts: [] },
    ])
    expect(graph.horizontals).toHaveLength(1)
    expect(graph.horizontals[0]!.label).toEqual({ type: 'assetFreeze', assetId: 4321 })
    expect(graph.horizontals[0]!.representation).toEqual({
      kind: 'vector',
      fromVertical: 0,
      toVertical: 1,
      direction: 'leftToRight',
      fromTag: 1,
      toTag: 2,
    })
  })

  test('afrz on the sender itself is a self loop', () => {
    const graph = buildTransactionsGraph(
      [{ ...base, type: 'afrz', assetId: 4321, freezeTarget: SENDER, frozen: false }],
      { appAddressFor },
    )
    expect(graph.verticals).toHaveLength(1)
    expect(graph.horizontals[0]!.representation).toEqual({
      kind: 'selfLoop',
      vertical: 0,
      fromTag: 1,
      toTag: 1,
    })
  })

  test('acfg create resolves the created asset id into an asset column', () => {
    const graph = buildTransactionsGraph(
      [
        {
          ...base,
          type: 'acfg',
          assetId: 0,
          createdAssetId: 987,
          assetConfig: { total: 1000, decimals: 2, manager: SENDER },
        },
      ],
      { appAddressFor },
    )

    expect(graph.verticals).toEqual([
      { type: 'account', address: SENDER, accountNumber: 1, associatedAccounts: [] },
      { type: 'asset', assetId: 987 },
    ])
    expect(graph.horizontals[0]!.label).toEqual({ type: 'assetCreate' })
    expect(graph.horizontals[0]!.representation).toEqual({
      kind: 'vector',
      fromVertical: 0,
      toVertical: 1,
      direction: 'leftToRight',
      fromTag: 1,
    })
  })

  test('acfg with params on an existing asset is a reconfigure', () => {
    const graph = buildTransactionsGraph(
      [{ ...base, type: 'acfg', assetId: 987, assetConfig: { total: 1000, decimals: 2 } }],
      { appAddressFor },
    )
    expect(graph.verticals[1]).toEqual({ type: 'asset', assetId: 987 })
    expect(graph.horizontals[0]!.label).toEqual({ type: 'assetReconfigure' })
  })

  test('acfg without params on an existing asset is a destroy', () => {
    const graph = buildTransactionsGraph([{ ...base, type: 'acfg', assetId: 987 }], { appAddressFor })
    expect(graph.verticals[1]).toEqual({ type: 'asset', assetId: 987 })
    expect(graph.horizontals[0]!.label).toEqual({ type: 'assetDestroy' })
  })

  test('a pending acfg create without a created id stays a point at the sender', () => {
    const graph = buildTransactionsGraph(
      [{ ...base, type: 'acfg', assetId: 0, assetConfig: { total: 1, decimals: 0 } }],
      { appAddressFor },
    )
    expect(graph.verticals).toHaveLength(1)
    expect(graph.horizontals[0]!.label).toEqual({ type: 'assetCreate' })
    expect(graph.horizontals[0]!.representation).toEqual({ kind: 'point', vertical: 0, fromTag: 1 })
  })

  test('a clawback keeps its revoked-account tag even when the operator is rekeyed', () => {
    const graph = buildTransactionsGraph(
      [
        {
          ...base,
          type: 'axfer',
          signer: 'REKEYEDSIGNERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          assetId: 99,
          assetAmount: 5,
          receiver: TARGET,
          clawbackFrom: 'REVOKEDACCOUNTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        },
      ],
      { appAddressFor },
    )
    expect(graph.horizontals[0]!.label.type).toBe('clawback')
    // The clawback tag (revoked account badge) wins over the rekey tag.
    expect(graph.horizontals[0]!.representation).toMatchObject({ kind: 'vector', fromTag: 2 })
  })
})

describe('wire-level approximations', () => {
  const SENDER = 'OPUPSENDERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  const opUpInner: GraphTransaction = {
    type: 'appl',
    sender: SENDER,
    feeMicroAlgos: 1000,
    applicationId: 0,
    onCompletion: 'delete',
  }

  test('op-up app creates merge into one opUp column', () => {
    const root: GraphTransaction = {
      id: 'ROOT',
      type: 'appl',
      sender: SENDER,
      feeMicroAlgos: 1000,
      applicationId: 500,
      onCompletion: 'noop',
      logs: ['aGk='],
    }
    const graph = buildTransactionsGraph([root, opUpInner, { ...opUpInner }], { appAddressFor })

    const opUpIndexes = graph.verticals.flatMap((v, i) => (v.type === 'opUp' ? [i] : []))
    expect(opUpIndexes).toHaveLength(1)
    expect(graph.horizontals.map((row) => row.label.type)).toEqual(['appCall', 'appCreate', 'appCreate'])
    for (const row of graph.horizontals.slice(1)) {
      expect(row.representation).toMatchObject({ kind: 'vector', toVertical: opUpIndexes[0]! })
    }
  })

  test('a create + delete with observable effects is not an op-up', () => {
    const busy: GraphTransaction = { ...opUpInner, logs: ['aGk='] }
    const graph = buildTransactionsGraph([busy], { appAddressFor })
    expect(graph.verticals.some((v) => v.type === 'opUp')).toBe(false)
    expect(graph.verticals.some((v) => v.type === 'application' && v.applicationId === 0)).toBe(true)
  })

  test('clawback rows tag the revoked account on the sender endpoint', () => {
    const clawback: GraphTransaction = {
      id: 'CLAW',
      type: 'axfer',
      sender: 'CLAWBACKOPERATORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      feeMicroAlgos: 1000,
      assetId: 99,
      assetAmount: 5,
      receiver: 'RECEIVERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      clawbackFrom: 'REVOKEDACCOUNTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    }
    const graph = buildTransactionsGraph([clawback], { appAddressFor })

    expect(graph.verticals).toEqual([
      {
        type: 'account',
        address: clawback.sender,
        accountNumber: 1,
        associatedAccounts: [{ kind: 'clawback', address: clawback.clawbackFrom!, accountNumber: 2 }],
      },
      { type: 'account', address: clawback.receiver!, accountNumber: 3, associatedAccounts: [] },
    ])
    expect(graph.horizontals[0]!.label).toEqual({ type: 'clawback', assetAmount: 5, assetId: 99 })
    expect(graph.horizontals[0]!.representation).toEqual({
      kind: 'vector',
      fromVertical: 0,
      toVertical: 1,
      direction: 'leftToRight',
      fromTag: 2,
      toTag: 3,
    })
  })

  test('without appAddressFor, escrow merging degrades to plain account columns', () => {
    const txn = transactions['KMNBSQ4ZFX252G7S4VYR4ZDZ3RXIET5CNYQVJUO5OXXPMHAMJCCQ']!
    const graph = buildTransactionsGraph([txn])

    // The escrow keeps its own account column and applications carry no linked account.
    expect(graph.verticals.map((v) => v.type)).toEqual(['account', 'application', 'account', 'application'])
    for (const vertical of graph.verticals) {
      if (vertical.type === 'application') expect(vertical.linkedAccount).toBeUndefined()
    }
    // Rows still reference valid columns.
    for (const row of graph.horizontals) {
      for (const index of verticalIndexes(row)) {
        expect(index).toBeLessThan(graph.verticals.length)
      }
    }
  })
})

describe('stored group records feed the graph', () => {
  test('a stored transaction.group record retains nested rows and graph-relevant fields', () => {
    const wire = (corpus as { groups: Record<string, unknown> }).groups[
      'wDegGrdXE32WoxPfioFELwPVWBIiZK0GF1bwos7fJs0='
    ]
    const record = buildTransactionGroupRecord(
      { resultId: 'result-group-retention', toolCallId: 'tool-call-group-retention', network: 'testnet' },
      wire,
    )
    if (record.state !== 'success') throw new Error('Expected success record')
    const data = record.data as { transactions: Array<{ innerTxns?: unknown[]; signer?: string }> }
    const nested = data.transactions.find((row) => row.innerTxns && row.innerTxns.length > 0)
    expect(nested).toBeDefined()

    // The graph built from the STORED record (not the raw wire) still nests.
    const graph = buildTransactionsGraph(data.transactions as never, {
      appAddressFor: (appId) => getApplicationAddress(BigInt(appId)).toString(),
    })
    expect(graph.horizontals.some((row) => row.depth > 0)).toBe(true)
  })
})

describe('ABI method names on app-call rows', () => {
  const appl = {
    type: 'appl' as const,
    sender: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
    feeMicroAlgos: 1000,
    applicationId: 1042,
    methodName: 'increment',
  }

  test('copies methodName from the transaction onto the appCall label', () => {
    const graph = buildTransactionsGraph([appl], { appAddressFor })
    expect(graph.horizontals[0]?.label).toEqual({ type: 'appCall', methodName: 'increment' })
  })

  test('methodNameFor fills the label when the transaction has none', () => {
    const { methodName: _drop, ...bare } = appl
    const graph = buildTransactionsGraph([bare], {
      appAddressFor,
      methodNameFor: () => 'greet',
    })
    expect(graph.horizontals[0]?.label.methodName).toBe('greet')
  })
})
