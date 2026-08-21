import { z } from 'zod'

/** Wire shape of lookup_account ('account.summary' view). */
export const formattedAccountSchema = z.object({
  address: z.string(),
  balanceMicroAlgos: z
    .union([z.number(), z.string()])
    .describe(
      'Balance in microALGOs (1 ALGO = 1,000,000 microALGOs); decimal string when above 2^53',
    ),
  totalAssetsOptedIn: z.number().optional(),
  totalAppsOptedIn: z.number().optional(),
  totalCreatedAssets: z.number().optional(),
  totalCreatedApps: z.number().optional(),
  status: z.string().optional(),
  minBalanceMicroAlgos: z
    .union([z.number(), z.string()])
    .optional()
    .describe(
      'Minimum balance in microALGOs (1 ALGO = 1,000,000 microALGOs); decimal string when above 2^53',
    ),
  rekeyedTo: z.string().optional(),
  rewardBase: z.union([z.number(), z.string()]).optional(),
  createdAtRound: z.number().optional(),
})

/** Wire shape of batch_lookup_accounts and search_accounts ('account.list' view). */
export const accountListSchema = z.object({
  accounts: z.array(formattedAccountSchema),
  // batch_lookup_accounts never paginates; the key is optional and absent there.
  nextToken: z.string().optional(),
})

const accountAsset = z.object({
  assetId: z.number(),
  amount: z.string().describe('Raw base units as a decimal string; scale by decimals for display'),
  isFrozen: z.boolean(),
  decimals: z.number().optional().describe('Asset decimals; absent when metadata lookup failed'),
  name: z.string().optional(),
  unitName: z.string().optional(),
})

const accountAppLocalState = z.object({
  applicationId: z.number(),
  schema: z.object({
    numByteSlice: z.number(),
    numUint: z.number(),
  }),
  keyValue: z.array(
    z.object({
      key: z.string(),
      value: z.object({
        type: z.number(),
        bytes: z.string().optional(),
        uint: z
          .union([z.number(), z.string()])
          .optional()
          .describe('uint64 app state; decimal string when above 2^53'),
      }),
    }),
  ),
})

/** Wire shape of get_account_assets ('asset.holdings' view). */
export const accountAssetListSchema = z.object({
  assets: z.array(accountAsset),
  nextToken: z.string().optional(),
})

/** Wire shape of get_account_app_local_states ('application.locals' view). */
export const appLocalStatesSchema = z.object({
  appLocalStates: z.array(accountAppLocalState),
  nextToken: z.string().optional(),
})

/** Wire shape of get_account_portfolio ('account.portfolio' view). */
export const accountPortfolioSchema = z.object({
  address: z.string(),
  balanceMicroAlgos: z
    .union([z.number(), z.string()])
    .describe(
      'Balance in microALGOs (1 ALGO = 1,000,000 microALGOs); decimal string when above 2^53',
    ),
  assets: z.array(accountAsset),
  totalAssets: z.number(),
})
