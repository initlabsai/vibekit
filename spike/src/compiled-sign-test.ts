/**
 * Verdict (b): does keystore RPC signing work from a `bun build --compile`
 * binary, with no native keyring addon linked in? This only imports the RPC
 * client path — if @napi-rs/keyring sneaks into the bundle, compile/run fails.
 */
import algosdk from 'algosdk'
import { listKeystoreAddresses, resolveKeystoreSigner } from './keystore-signer'

const [address] = await listKeystoreAddresses()
if (!address) throw new Error('no keys in keystore daemon')

const suggestedParams: algosdk.SuggestedParams = {
  fee: BigInt(1000),
  minFee: BigInt(1000),
  flatFee: true,
  firstValid: BigInt(1),
  lastValid: BigInt(1000),
  genesisID: 'testnet-v1.0',
  genesisHash: new Uint8Array(32),
}
const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
  sender: address,
  receiver: address,
  amount: 0,
  suggestedParams,
})

const signer = await resolveKeystoreSigner(address)
const [signed] = await signer([txn], [0])
const decoded = algosdk.decodeSignedTransaction(signed!)
console.log('compiled binary signed via daemon:', decoded.sig ? 'OK' : 'MISSING SIG')
console.log('address:', address)
