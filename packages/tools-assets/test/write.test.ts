import { describe, expect, test } from 'bun:test'
import algosdk from 'algosdk'
import { base64ToBytes } from '@initlabs/core'
import { assetWriteTools } from '../src/tools-write.js'
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
  test('registry: 7 writes require signer + get_asset_info read', () => {
    const names = assetWriteTools.map((t) => t.name)
    expect(names).toEqual([
      'create_asset',
      'asset_transfer',
      'asset_opt_in',
      'asset_opt_out',
      'asset_freeze',
      'asset_config',
      'asset_destroy',
      'get_asset_info',
    ])
    for (const tool of assetWriteTools) {
      expect(tool.requiresSigner ?? false).toBe(tool.name !== 'get_asset_info')
      expect(tool.output).toBeDefined()
    }
  })

  test('create_asset composes an acfg create with metadata hash', async () => {
    const ctx = fakeContext({ algod: { getTransactionParams: () => chainable(suggestedParams) } })
    const tool = assetWriteTools.find((t) => t.name === 'create_asset')!
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

  test('get_asset_info shapes algod response', async () => {
    const ctx = fakeContext({
      algod: {
        getAssetByID: () =>
          chainable({
            index: BigInt(42),
            params: {
              name: 'Coin',
              unitName: 'C',
              total: BigInt(9),
              decimals: BigInt(0),
              creator: ADDR_A,
            },
          }),
      },
    })
    const tool = assetWriteTools.find((t) => t.name === 'get_asset_info')!
    const info = (await tool.handler(ctx, { assetId: 42 } as never)) as { assetId: number; creator: string }
    expect(info.assetId).toBe(42)
    expect(info.creator).toBe(ADDR_A)
  })
})
