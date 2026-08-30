/** The paywall from env: the house USDC address, the price, and the chain — mainnet in production, testnet in `next dev`. */
import { createPaywall, DEFAULT_FACILITATOR_URL, type Paywall } from '@initlabs/vibekit/pay'

import { isProduction } from '../explorer/endpoints'
import { FREE_TURNS, store, TURNS_PER_PACK } from './ledger'

export { formatUsdc } from '@initlabs/vibekit/pay'
export const FACILITATOR_URL = process.env.X402_FACILITATOR_URL ?? DEFAULT_FACILITATOR_URL
export const MAX_TURNS_PER_BUY = 1000

let built: { key: string; paywall: Paywall } | undefined

/** Set when X402_PAY_TO names the house address and AGENT_BILLING is not forced to `house`. Built once per env. */
export function paywall(): Paywall | undefined {
  const payTo = process.env.X402_PAY_TO
  if (!payTo || process.env.AGENT_BILLING === 'house') return undefined
  // X402_NETWORK names the chain outright (an alpha can sell packs for testnet USDC in production);
  // otherwise production means mainnet and `next dev` means testnet.
  const chain =
    process.env.X402_NETWORK === 'testnet' || process.env.X402_NETWORK === 'mainnet'
      ? process.env.X402_NETWORK
      : isProduction()
        ? 'mainnet'
        : 'testnet'
  const configured = Number(process.env.X402_PRICE_MICROUSDC)
  const priceMicroUsdc = Number.isInteger(configured) && configured > 0 ? configured : 1_000_000
  const asset = /^\d+$/.test(process.env.X402_ASSET_ID ?? '') ? process.env.X402_ASSET_ID : undefined
  const key = [payTo, chain, priceMicroUsdc, asset, FACILITATOR_URL].join('|')
  if (built?.key !== key) {
    built = {
      key,
      paywall: createPaywall({
        chain,
        payTo,
        ...(asset ? { asset } : {}),
        facilitatorUrl: FACILITATOR_URL,
        priceMicroUsdc,
        turnsPerPack: TURNS_PER_PACK,
        maxTurnsPerBuy: MAX_TURNS_PER_BUY,
        freeTurns: FREE_TURNS,
        store,
        refusal: (offer) => `Out of turns — /buy a pack (${offer.price} → ${offer.turnsPerPack} turns).`,
      }),
    }
  }
  return built.paywall
}
