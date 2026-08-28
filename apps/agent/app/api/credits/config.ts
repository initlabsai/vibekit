/** Where a credit pack is paid: the house USDC address, the price, and the chain — mainnet in production, testnet in `next dev`. */
import { ALGORAND_MAINNET_GENESIS_HASH, ALGORAND_TESTNET_GENESIS_HASH, USDC_DECIMALS, USDC_MAINNET_ASA_ID, USDC_TESTNET_ASA_ID } from '@x402/avm'
import type { Network } from '@x402/next'

import { isProduction } from '../explorer/endpoints'
import { TURNS_PER_PACK } from './ledger'

export const FACILITATOR_URL = process.env.X402_FACILITATOR_URL ?? 'https://facilitator.goplausible.xyz'

export interface CreditsConfig {
  payTo: string
  /** The default pack in USDC base units (6 decimals): X402_PRICE_MICROUSDC, default 1_000_000 = $1.00. */
  priceMicroUsdc: number
  /** One turn's share of that: the pack price over AGENT_TURNS_PER_PACK. `/buy N` pays N of these. */
  pricePerTurnMicroUsdc: number
  /** `$1.00` — what people see. */
  price: string
  /** The ASA the payment moves: X402_ASSET_ID, else USDC for the chain. */
  asset: string
  chain: 'mainnet' | 'testnet'
  network: Network
}

const DEFAULT_PRICE_MICROUSDC = 1_000_000
export const MAX_TURNS_PER_BUY = 1000

/** Base units as dollars: 1_000_000 → `$1.00`, 250_000 → `$0.25`. */
export function formatUsdc(microUsdc: number): string {
  return `$${(microUsdc / 10 ** USDC_DECIMALS).toFixed(2)}`
}

/** Set when X402_PAY_TO names the house address and AGENT_BILLING is not forced to `house`. */
export function creditsConfig(): CreditsConfig | undefined {
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
  const priceMicroUsdc = Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_PRICE_MICROUSDC
  // Whole base units per turn, so N turns always cost exactly N times the same figure.
  const pricePerTurnMicroUsdc = Math.max(1, Math.floor(priceMicroUsdc / TURNS_PER_PACK))
  return {
    payTo,
    priceMicroUsdc: pricePerTurnMicroUsdc * TURNS_PER_PACK,
    pricePerTurnMicroUsdc,
    price: formatUsdc(pricePerTurnMicroUsdc * TURNS_PER_PACK),
    asset: /^\d+$/.test(process.env.X402_ASSET_ID ?? '') ? process.env.X402_ASSET_ID! : chain === 'mainnet' ? USDC_MAINNET_ASA_ID : USDC_TESTNET_ASA_ID,
    chain,
    // The facilitator advertises `algorand:<full genesis hash>`, and core matches that string
    // exactly; the AVM schemes accept either form, so the long one is the one that works end to end.
    network: `algorand:${chain === 'mainnet' ? ALGORAND_MAINNET_GENESIS_HASH : ALGORAND_TESTNET_GENESIS_HASH}` as Network,
  }
}

/** `?turns=N` on a purchase, clamped to 1…MAX_TURNS_PER_BUY; the pack size when absent or unreadable. */
export function turnsRequested(raw: string | string[] | null | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) return TURNS_PER_PACK
  return Math.min(n, MAX_TURNS_PER_BUY)
}
