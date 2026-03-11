import { z } from 'zod'
import type { ToolDefinition } from '@vibekit/core'
import {
  createAsset,
  transferAsset,
  optInAsset,
  optOutAsset,
  freezeAsset,
  configAsset,
  destroyAsset,
  getAssetInfo,
} from './handlers/write'

export const assetWriteTools: ToolDefinition[] = [
  {
    name: 'create_asset',
    description:
      'Create a new Algorand Standard Asset (ASA). ' +
      'Use for fungible tokens (decimals > 0) or NFTs (total=1, decimals=0). ' +
      'The creator automatically holds all units and can configure manager/reserve/freeze/clawback addresses.',
    parameters: z.object({
      total: z.number().describe('Total supply in smallest divisible unit. For NFTs use 1. For fungible tokens, account for decimals (e.g., 1000000 with decimals=6 = 1.0 token)'),
      decimals: z.number().optional().describe('Number of decimal places (0-19). Use 0 for NFTs, 6 for ALGO-like tokens. Default: 0'),
      assetName: z.string().optional().describe('Full asset name (max 32 bytes). Example: "My Token"'),
      unitName: z.string().optional().describe('Ticker/unit name (max 8 bytes). Example: "MTK"'),
      url: z.string().optional().describe('Metadata URL (max 96 bytes). For NFTs, often points to IPFS metadata'),
      metadataHash: z.string().optional().describe('Optional 32-byte metadata hash (hex or base64 encoded)'),
      defaultFrozen: z.boolean().optional().describe('If true, asset holdings are frozen by default. Default: false'),
      manager: z.string().optional().describe('Address that can reconfigure or destroy the asset. If omitted, uses creator address'),
      reserve: z.string().optional().describe('Address holding non-circulating supply (informational only)'),
      freeze: z.string().optional().describe('Address that can freeze/unfreeze asset holdings'),
      clawback: z.string().optional().describe('Address that can revoke assets from any holder'),
      sender: z.string().optional().describe('Creator address. Defaults to active account'),
    }),
    handler: async ({ algorand, args, resolveSender }) => createAsset(algorand, args, resolveSender),
  },
  {
    name: 'asset_transfer',
    description:
      'Transfer assets between accounts. ' +
      'Receiver must have opted into the asset first. ' +
      'For clawback, set clawbackTarget to revoke from that account (sender must be clawback address).',
    parameters: z.object({
      assetId: z.number().describe('The asset ID to transfer'),
      amount: z.number().describe('Amount to transfer in smallest divisible units'),
      receiver: z.string().describe('Receiver address (must have opted into the asset)'),
      sender: z.string().optional().describe('Sender address. Defaults to active account'),
      clawbackTarget: z.string().optional().describe('For clawback: the account to revoke assets from. Sender must be the asset clawback address'),
      closeAssetTo: z.string().optional().describe('Close asset position to this address. Transfers remaining balance and removes asset from account'),
      note: z.string().optional().describe('Optional transaction note (max 1000 bytes)'),
    }),
    handler: async ({ algorand, args, resolveSender }) => transferAsset(algorand, args, resolveSender),
  },
  {
    name: 'asset_opt_in',
    description:
      'Opt an account into receiving an asset. ' +
      'Required before the account can receive transfers of that asset. ' +
      'Increases minimum balance by 0.1 ALGO.',
    parameters: z.object({
      assetId: z.number().describe('The asset ID to opt into'),
      sender: z.string().optional().describe('Account to opt in. Defaults to active account'),
    }),
    handler: async ({ algorand, args, resolveSender }) => optInAsset(algorand, args, resolveSender),
  },
  {
    name: 'asset_opt_out',
    description:
      'Opt out of an asset and close the position. ' +
      'Any remaining balance is sent to the creator (or specified address). ' +
      'Reduces minimum balance by 0.1 ALGO. Use ensureZeroBalance=true to fail if balance > 0.',
    parameters: z.object({
      assetId: z.number().describe('The asset ID to opt out of'),
      creator: z.string().describe('Address to return remaining assets to (typically the asset creator)'),
      sender: z.string().optional().describe('Account to opt out. Defaults to active account'),
      ensureZeroBalance: z.boolean().optional().describe('If true, fail if account has non-zero balance. Default: true'),
    }),
    handler: async ({ algorand, args, resolveSender }) => optOutAsset(algorand, args, resolveSender),
  },
  {
    name: 'asset_freeze',
    description:
      "Freeze or unfreeze an account's asset holdings. " +
      'Frozen accounts cannot send or receive the asset. ' +
      "Sender must be the asset's freeze address.",
    parameters: z.object({
      assetId: z.number().describe('The asset ID'),
      account: z.string().describe('The account to freeze/unfreeze'),
      frozen: z.boolean().describe('True to freeze, false to unfreeze'),
      sender: z.string().optional().describe('Must be the asset freeze address. Defaults to active account'),
    }),
    handler: async ({ algorand, args, resolveSender }) => freezeAsset(algorand, args, resolveSender),
  },
  {
    name: 'asset_config',
    description:
      "Reconfigure an asset's management addresses. " +
      'Sender must be the current manager. ' +
      'Pass empty string to remove an address (makes it immutable). ' +
      'Omitted fields keep their current values.',
    parameters: z.object({
      assetId: z.number().describe('The asset ID to reconfigure'),
      manager: z.string().optional().describe('New manager address. Empty string removes manager permanently'),
      reserve: z.string().optional().describe('New reserve address. Empty string removes reserve'),
      freeze: z.string().optional().describe('New freeze address. Empty string removes freeze capability'),
      clawback: z.string().optional().describe('New clawback address. Empty string removes clawback capability'),
      sender: z.string().optional().describe('Must be current manager. Defaults to active account'),
    }),
    handler: async ({ algorand, args, resolveSender }) => configAsset(algorand, args, resolveSender),
  },
  {
    name: 'asset_destroy',
    description:
      'Destroy an asset permanently. ' +
      'Sender must be the manager, and the creator must hold all units. ' +
      'This action is irreversible.',
    parameters: z.object({
      assetId: z.number().describe('The asset ID to destroy'),
      sender: z.string().optional().describe('Must be the asset manager. Defaults to active account'),
    }),
    handler: async ({ algorand, args, resolveSender }) => destroyAsset(algorand, args, resolveSender),
  },
  {
    name: 'get_asset_info',
    description:
      'Get detailed information about an Algorand Standard Asset (ASA) by its ID. ' +
      'Returns creator, total supply, decimals, name, and management addresses.',
    parameters: z.object({
      assetId: z.number().describe('The asset ID to query'),
    }),
    handler: async ({ algorand, args }) => getAssetInfo(algorand, args),
  },
]
