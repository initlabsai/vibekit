/** Asset write tools: thin spec-builders over the core compose engine. */
import {
  composeOrExecute,
  defineTool,
  ToolError,
  writeResultSchema,
  type AnyTool,
  type TxnSpec,
} from '@initlabs/vibekit-core'
import { z } from 'zod'

const sender = z.string().describe('Sender address')
const note = z.string().optional().describe('Optional note (max 1000 bytes)')

function writeTool<P extends z.ZodType>(def: {
  name: string
  description: string
  parameters: P
  toSpec: (args: z.infer<P>) => TxnSpec
}): AnyTool {
  return defineTool({
    name: def.name,
    description: `${def.description} In compose mode returns the unsigned transaction for external signing.`,
    parameters: def.parameters,
    output: writeResultSchema,
    requiresSigner: true,
    display: 'txn',
    handler: async (ctx, args) => composeOrExecute(ctx, [def.toSpec(args)]),
  }) as AnyTool
}

export const assetWriteTools: AnyTool[] = [
  writeTool({
    name: 'create_asset',
    description: 'Create a new Algorand Standard Asset (ASA).',
    parameters: z.object({
      sender,
      total: z.number().describe('Total supply in base units'),
      decimals: z.number().min(0).max(19).optional().describe('Decimals (default 0)'),
      assetName: z.string().max(32).optional().describe('Asset name'),
      unitName: z.string().max(8).optional().describe('Unit name'),
      url: z.string().max(96).optional().describe('Asset URL'),
      metadataHash: z
        .string()
        .optional()
        .describe('32-byte metadata hash (64 hex or 44 base64 chars)'),
      defaultFrozen: z.boolean().optional().describe('Holdings frozen by default'),
      manager: z.string().optional().describe('Manager address (can reconfigure)'),
      reserve: z.string().optional().describe('Reserve address'),
      freeze: z.string().optional().describe('Freeze address'),
      clawback: z.string().optional().describe('Clawback address'),
      note,
    }),
    toSpec: (a) => ({ ...a, type: 'asset_create' }),
  }),
  writeTool({
    name: 'asset_transfer',
    description: 'Transfer an ASA between accounts (or claw back with clawbackTarget).',
    parameters: z.object({
      sender,
      assetId: z.number().describe('The asset ID'),
      receiver: z.string().describe('Receiver address'),
      amount: z.number().describe('Amount in base units of the asset'),
      clawbackTarget: z.string().optional().describe('Clawback: account to claw back from'),
      closeAssetTo: z
        .string()
        .optional()
        .describe('Account receiving remaining asset balance — CLOSES the position; requires confirmCloseAccount: true'),
      confirmCloseAccount: z
        .boolean()
        .optional()
        .describe('Must be true when closeAssetTo is set'),
      note,
    }),
    toSpec: (a) => ({ ...a, type: 'asset_transfer' }),
  }),
  writeTool({
    name: 'asset_opt_in',
    description: 'Opt the sender account into an ASA so it can receive it.',
    parameters: z.object({ sender, assetId: z.number().describe('The asset ID'), note }),
    toSpec: (a) => ({ ...a, type: 'asset_opt_in' }),
  }),
  writeTool({
    name: 'asset_opt_out',
    description:
      'Opt the sender out of an ASA, closing remaining balance to closeAssetTo (usually the creator). Fails on non-zero balance unless ensureZeroBalance is false.',
    parameters: z.object({
      sender,
      assetId: z.number().describe('The asset ID'),
      closeAssetTo: z.string().describe('Account receiving remaining balance (usually the creator)'),
      ensureZeroBalance: z.boolean().optional().describe('Fail if balance non-zero (default true)'),
      note,
    }),
    toSpec: (a) => ({ ...a, type: 'asset_opt_out' }),
  }),
  writeTool({
    name: 'asset_freeze',
    description: 'Freeze or unfreeze an account\'s holding of an ASA (sender must be the freeze address).',
    parameters: z.object({
      sender,
      assetId: z.number().describe('The asset ID'),
      freezeTarget: z.string().describe('Account to freeze/unfreeze'),
      frozen: z.boolean().describe('true = freeze, false = unfreeze'),
      note,
    }),
    toSpec: (a) => ({ ...a, type: 'asset_freeze' }),
  }),
  writeTool({
    name: 'asset_config',
    description:
      'Reconfigure an ASA\'s role addresses (sender must be the manager). Omitted addresses are cleared PERMANENTLY and require confirmClearRoles: true.',
    parameters: z.object({
      sender,
      assetId: z.number().describe('The asset ID'),
      confirmClearRoles: z
        .boolean()
        .optional()
        .describe('Must be true to clear any omitted role address (clearing is permanent)'),
      manager: z.string().optional().describe('New manager address'),
      reserve: z.string().optional().describe('New reserve address'),
      freeze: z.string().optional().describe('New freeze address'),
      clawback: z.string().optional().describe('New clawback address'),
      note,
    }),
    toSpec: (a) => ({ ...a, type: 'asset_config' }),
  }),
  writeTool({
    name: 'asset_destroy',
    description:
      'Destroy an ASA (sender must be the manager; all units must be back in the creator account).',
    parameters: z.object({ sender, assetId: z.number().describe('The asset ID'), note }),
    toSpec: (a) => ({ ...a, type: 'asset_destroy' }),
  }),
  defineTool({
    name: 'get_asset_info',
    description: 'Get an asset\'s current parameters directly from algod (name, supply, roles, frozen state).',
    parameters: z.object({ assetId: z.number().describe('The asset ID') }),
    output: z.object({
      assetId: z.number(),
      name: z.string().optional(),
      unitName: z.string().optional(),
      total: z.union([z.number(), z.string()]),
      decimals: z.number(),
      defaultFrozen: z.boolean().optional(),
      url: z.string().optional(),
      creator: z.string(),
      manager: z.string().optional(),
      reserve: z.string().optional(),
      freeze: z.string().optional(),
      clawback: z.string().optional(),
    }),
    display: 'asset',
    handler: async (ctx, args) => {
      const asset = await ctx.algod.getAssetByID(BigInt(args.assetId)).do()
      const params = asset.params
      if (!params) {
        throw new ToolError('ASSET_NOT_FOUND', `Asset ${args.assetId} has no parameters`)
      }
      return {
        assetId: Number(asset.index),
        name: params.name,
        unitName: params.unitName,
        total: params.total,
        decimals: Number(params.decimals),
        defaultFrozen: params.defaultFrozen,
        url: params.url,
        creator: String(params.creator),
        manager: params.manager ? String(params.manager) : undefined,
        reserve: params.reserve ? String(params.reserve) : undefined,
        freeze: params.freeze ? String(params.freeze) : undefined,
        clawback: params.clawback ? String(params.clawback) : undefined,
      }
    },
  }) as AnyTool,
]
