/**
 * The LocalNet smoke: real algod and indexer, real signatures, through
 * executeToolCall — the one gate the unit tests' mocked clients cannot be.
 * Needs a running LocalNet (`vibekit localnet start`). Run from the repo
 * root: `bun run smoke:localnet`. Lives in the CLI workspace because that is
 * where algosdk and the package are dependencies.
 */
import algosdk from 'algosdk'

import {
  executeToolCall,
  resolveDeployment,
  type AnyTool,
  type ResolvedDeployment,
} from '@initlabs/vibekit'
import { defaultTools } from '@initlabs/vibekit/preset'

import { fundFromKmd } from '../src/commands/localnet/fund.js'

const sender = algosdk.generateAccount()
const receiver = algosdk.generateAccount()

const deployment = resolveDeployment({
  network: 'localnet',
  mode: 'execute',
  tools: defaultTools,
  resolveSigner: async (address) => {
    if (address !== sender.addr.toString()) throw new Error(`No key for ${address}`)
    return algosdk.makeBasicAccountTransactionSigner(sender)
  },
})

function tool(name: string): AnyTool {
  const found = deployment.tools.find((candidate) => candidate.name === name)
  if (!found) throw new Error(`smoke: no tool named ${name}`)
  return found
}

async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  return (await executeToolCall(deployment, tool(name), args)) as T
}

/** The indexer trails algod by a round or two; retry a read until it agrees. */
async function eventually<T>(what: string, read: () => Promise<T>, attempts = 30): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await read()
    } catch (error) {
      last = error
      await Bun.sleep(1000)
    }
  }
  throw new Error(`smoke: ${what} never appeared in the indexer — ${String(last)}`)
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`smoke: ${message}`)
  console.log(`  ✓ ${message}`)
}

void (deployment satisfies ResolvedDeployment)

console.log('smoke: network')
const status = await call<{ latestRound: number; network: string }>('get_network_status', {})
check(
  status.network === 'localnet' && status.latestRound > 0,
  `localnet at round ${status.latestRound}`,
)

console.log('smoke: fund the sender from the KMD dispenser')
const funded = await fundFromKmd(sender.addr.toString(), 20_000_000n)
check(funded.txId.length === 52, `funded ${funded.from.slice(0, 8)}… → sender (${funded.txId})`)

console.log('smoke: send_payment in execute mode')
const payment = await call<{ txids: string[]; confirmedRound: number }>('send_payment', {
  sender: sender.addr.toString(),
  receiver: receiver.addr.toString(),
  amountMicroAlgos: 1_500_000,
  note: 'vibekit smoke',
})
check(
  payment.txids.length === 1 && payment.confirmedRound > 0,
  `payment confirmed in round ${payment.confirmedRound}`,
)

console.log('smoke: the indexer sees it')
const txn = await eventually('the payment', () =>
  call<{ id?: string; paymentAmountMicroAlgos?: number; note?: string; receiver?: string }>(
    'lookup_transaction',
    { txid: payment.txids[0] },
  ),
)
check(txn.paymentAmountMicroAlgos === 1_500_000, 'lookup_transaction reports the amount')
check(txn.receiver === receiver.addr.toString(), 'lookup_transaction reports the receiver')
check(txn.note === 'vibekit smoke', 'lookup_transaction decodes the note')

const account = await eventually('the receiver account', () =>
  call<{ address: string; balanceMicroAlgos: number | string }>('lookup_account', {
    address: receiver.addr.toString(),
  }),
)
check(Number(account.balanceMicroAlgos) === 1_500_000, 'lookup_account reports the balance')

const history = await eventually('the sender history', async () => {
  const page = await call<{ transactions: Array<{ id?: string }> }>('search_account_transactions', {
    address: sender.addr.toString(),
    limit: 10,
  })
  if (!page.transactions.some((entry) => entry.id === payment.txids[0])) throw new Error('not yet')
  return page
})
check(
  history.transactions.length >= 2,
  'search_account_transactions lists the funding and the payment',
)

console.log('smoke: asset_create in execute mode, then lookup_asset')
const created = await call<{ txids: string[] }>('asset_create', {
  sender: sender.addr.toString(),
  total: 1_000_000,
  decimals: 2,
  assetName: 'Smoke Token',
  unitName: 'SMK',
})
const createTxn = await eventually('the asset create', () =>
  call<{ createdAssetId?: number }>('lookup_transaction', { txid: created.txids[0] }),
)
check(typeof createTxn.createdAssetId === 'number', `asset ${createTxn.createdAssetId} created`)
const asset = await eventually('the asset', () =>
  call<{ assetId: number; unitName?: string; totalSupply: string; decimals: number }>(
    'lookup_asset',
    { assetId: createTxn.createdAssetId },
  ),
)
check(
  asset.unitName === 'SMK' && asset.totalSupply === '1000000',
  'lookup_asset reports the params',
)

console.log('smoke: simulate_transactions needs no signature')
const simulation = await call<{ wouldSucceed: boolean; txids: string[] }>('simulate_transactions', {
  transactions: [
    {
      type: 'payment',
      sender: sender.addr.toString(),
      receiver: receiver.addr.toString(),
      amountMicroAlgos: 1,
    },
  ],
})
check(
  simulation.wouldSucceed && simulation.txids.length === 1,
  'the simulated payment would succeed',
)

console.log('smoke: ok')
