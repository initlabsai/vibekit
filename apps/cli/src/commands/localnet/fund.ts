/**
 * LocalNet funding — pays out from the localnet dispenser via kmd
 * (the richest key in the unencrypted default wallet, same heuristic as
 * algokit-utils' getLocalNetDispenserAccount).
 */

import algosdk from 'algosdk'

import { ALGOD_PORT, KMD_PORT, LOCALNET_TOKEN } from './compose.js'

const DEFAULT_WALLET = 'unencrypted-default-wallet'
export const DEFAULT_FUND_MICROALGOS = 10_000_000n // 10 ALGO

export interface FundResult {
  txId: string
  from: string
  amount: bigint
}

export async function fundFromKmd(
  receiver: string,
  amount: bigint = DEFAULT_FUND_MICROALGOS,
): Promise<FundResult> {
  if (!algosdk.isValidAddress(receiver)) {
    throw new Error(`Invalid Algorand address: ${receiver}`)
  }

  const kmd = new algosdk.Kmd(LOCALNET_TOKEN, 'http://localhost', KMD_PORT)
  const algod = new algosdk.Algodv2(LOCALNET_TOKEN, 'http://localhost', ALGOD_PORT)

  const { wallets } = (await kmd.listWallets()) as { wallets: Array<{ id: string; name: string }> }
  const wallet = wallets.find((w) => w.name === DEFAULT_WALLET)
  if (!wallet) {
    throw new Error(
      `LocalNet dispenser wallet ('${DEFAULT_WALLET}') not found — is the localnet running?`,
    )
  }

  const handle = ((await kmd.initWalletHandle(wallet.id, '')) as { wallet_handle_token: string })
    .wallet_handle_token

  try {
    const { addresses } = (await kmd.listKeys(handle)) as { addresses: string[] }
    if (addresses.length === 0) {
      throw new Error('LocalNet dispenser wallet has no keys')
    }

    // pick the richest account as the dispenser
    let dispenser = ''
    let best = -1n
    for (const address of addresses) {
      const info = await algod.accountInformation(address).do()
      if (info.amount > best) {
        best = info.amount
        dispenser = address
      }
    }

    const { private_key: privateKey } = await kmd.exportKey(handle, '', dispenser)

    const suggestedParams = await algod.getTransactionParams().do()
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: dispenser,
      receiver,
      amount,
      suggestedParams,
    })

    const signed = txn.signTxn(privateKey)
    const { txid } = await algod.sendRawTransaction(signed).do()
    await algosdk.waitForConfirmation(algod, txid, 4)

    return { txId: txid, from: dispenser, amount }
  } finally {
    await kmd.releaseWalletHandle(handle).catch(() => {})
  }
}
