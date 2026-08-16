/**
 * The one tool this package offers: expose the keystore daemon's address book
 * to agents. Registered by hosts only in execute-mode deployments (a signer
 * exists), so read-only/compose deployments never advertise it. No stored
 * state — every call queries the daemon live (§10).
 */

import { z } from 'zod'
import { defineTool } from '@initlabs/vibekit-core'

import type { KeystoreSigner } from './index.js'

export function createSigningAddressesTool(signer: Pick<KeystoreSigner, 'listAddresses'>) {
  return defineTool({
    name: 'list_signing_addresses',
    description:
      "List the Algorand addresses this deployment can sign for — the user's local keystore accounts. Use when the user says 'my account(s)' or a sender address is needed and none was given.",
    parameters: z.object({}),
    output: z.object({
      accounts: z.array(z.object({ address: z.string() })),
      count: z.number(),
    }),
    display: 'table',
    handler: async () => {
      const addresses = await signer.listAddresses()
      return { accounts: addresses.map((address) => ({ address })), count: addresses.length }
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
    handler: async (_ctx, args) => {
      const { address, keyId } = await signer.createAccount(args.name)
      return { address, keyId, ...(args.name ? { name: args.name } : {}) }
    },
  })
}
