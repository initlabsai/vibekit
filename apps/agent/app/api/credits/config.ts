/** Where a credit pack is paid: the house USDC address, the price, and the chain — mainnet in production, testnet in `next dev`. */
import { ALGORAND_MAINNET_CAIP2, ALGORAND_TESTNET_CAIP2 } from '@x402/avm'
import type { Network } from '@x402/next'

import { isProduction } from '../explorer/endpoints'

export const FACILITATOR_URL = process.env.X402_FACILITATOR_URL ?? 'https://facilitator.goplausible.xyz'

export interface CreditsConfig {
  payTo: string
  price: string
  chain: 'mainnet' | 'testnet'
  network: Network
}

/** Set when X402_PAY_TO names the house address and AGENT_BILLING is not forced to `house`. */
export function creditsConfig(): CreditsConfig | undefined {
  const payTo = process.env.X402_PAY_TO
  if (!payTo || process.env.AGENT_BILLING === 'house') return undefined
  const chain = isProduction() || process.env.X402_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
  return {
    payTo,
    price: process.env.X402_PRICE ?? '$1.00',
    chain,
    network: (chain === 'mainnet' ? ALGORAND_MAINNET_CAIP2 : ALGORAND_TESTNET_CAIP2) as Network,
  }
}
