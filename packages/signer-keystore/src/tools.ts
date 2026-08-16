/**
 * The one tool this package offers: expose the keystore daemon's address book
 * to agents. Registered by hosts only in execute-mode deployments (a signer
 * exists), so read-only/compose deployments never advertise it. No stored
 * state — every call queries the daemon live (§10).
 */

import { z } from 'zod'
import { defineTool } from '@initlabs/vibekit-core'

import type { KeystoreSigner } from './index.js'

export function createSigningAddressesTool(signer: Pick<KeystoreSigner, 'listAccounts'>) {
  return defineTool({
    name: 'list_signing_addresses',
    description:
      "List the Algorand accounts this deployment can sign for — the user's local keystore accounts, with their labels. Use when the user says 'my account(s)' or a sender address is needed and none was given. Set includeBalances for ALGO balances (uses the network parameter on multi-network deployments).",
    parameters: z.object({
      includeBalances: z
        .boolean()
        .optional()
        .describe('Also fetch each account ALGO balance from algod'),
    }),
    output: z.object({
      accounts: z.array(
        z.object({
          address: z.string(),
          name: z.string().optional(),
          balanceAlgo: z.number().optional(),
        }),
      ),
      count: z.number(),
    }),
    display: 'table',
    handler: async (ctx, args) => {
      const accounts = await signer.listAccounts()
      const rows = await Promise.all(
        accounts.map(async ({ address, name }) => {
          const base = { address, ...(name ? { name } : {}) }
          if (!args.includeBalances) return base
          const info = await ctx.algod.accountInformation(address).do()
          return { ...base, balanceAlgo: Number(info.amount) / 1_000_000 }
        }),
      )
      return { accounts: rows, count: rows.length }
    },
  })
}

export function createSigningAccountTool(signer: Pick<KeystoreSigner, 'createAccount'>) {
  return defineTool({
    name: 'create_signing_account',
    description:
      'Create a new local Algorand account in the keystore daemon (OS keychain; the private key is unextractable and never returned). Returns the address. The account starts unfunded. For mnemonic/seed-phrase flows the user must run the keystore CLI themselves.',
    parameters: z.object({
      name: z.string().max(64).optional().describe('Human-readable label for the key'),
    }),
    output: z.object({
      address: z.string(),
      keyId: z.string(),
      name: z.string().optional(),
    }),
    display: 'account',
    // Mints a key in the OS keychain — gated (approval + non-read-only hints).
    mutatesState: true,
    handler: async (_ctx, args) => {
      const { address, keyId } = await signer.createAccount(args.name)
      return { address, keyId, ...(args.name ? { name: args.name } : {}) }
    },
  })
}
