import { describe, expect, test } from 'bun:test'
import algosdk from 'algosdk'
import { base64ToBytes } from '../../src/core/index.js'
import { assetWriteTools } from '../../src/tools/assets/tools-write.js'
import { chainable, fakeContext } from './fake-context.js'

const ADDR_A = 'Y76M3MSY6DKBRHBL7C3NNDXGS5IIMQVQVUAB6MP4XEMMGVF2QWNPL226CA'

const suggestedParams = {
  flatFee: false,
  fee: BigInt(0),
  minFee: BigInt(1000),
  firstValid: BigInt(1),
  lastValid: BigInt(1000),
  genesisID: 'x',
  genesisHash: new Uint8Array(32),
}

describe('asset write tools', () => {
  test('registry: 7 writes require signer', () => {
    const names = assetWriteTools.map((t) => t.name)
    expect(names).toEqual([
      'asset_create',
      'asset_transfer',
      'asset_opt_in',
      'asset_opt_out',
      'asset_freeze',
      'asset_config',
      'asset_destroy',
    ])
    for (const tool of assetWriteTools) {
      expect(tool.requiresSigner).toBe(true)
      expect(tool.output).toBeDefined()
    }
  })

  test('asset_create composes an acfg create with metadata hash', async () => {
    const ctx = fakeContext({ algod: { getTransactionParams: () => chainable(suggestedParams) } })
    const tool = assetWriteTools.find((t) => t.name === 'asset_create')!
    const result = (await tool.handler(ctx, {
      sender: ADDR_A,
      total: 1_000_000,
      decimals: 2,
      assetName: 'Spike Coin',
      unitName: 'SPK',
      metadataHash: 'a'.repeat(64),
    } as never)) as { unsignedGroup: string[] }
    const txn = algosdk.decodeUnsignedTransaction(base64ToBytes(result.unsignedGroup[0]!))
    expect(txn.assetConfig?.total).toBe(BigInt(1_000_000))
    expect(txn.assetConfig?.decimals).toBe(2)
  })
})
