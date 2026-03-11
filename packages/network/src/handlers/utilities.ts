/**
 * Utility handlers — pure Algorand functions with no network calls.
 */

import { isValidAddress, getApplicationAddress } from 'algosdk'

// Algorand MBR constants (in microALGO)
const BASE_MBR = 100_000
const ASSET_MBR = 100_000
const APP_BASE_MBR = 100_000
const APP_OPTED_IN_MBR = 100_000
const BOX_FLAT_MBR = 2_500
const BOX_BYTE_MBR = 400

export function validateAddress(args: { address: string }) {
  const { address } = args
  if (typeof address !== 'string') throw new Error('address must be a string')
  return { address, valid: isValidAddress(address) }
}

export function deriveApplicationAddress(args: { appId: number }) {
  const { appId } = args
  if (!Number.isInteger(appId) || appId < 0) throw new Error('appId must be a non-negative integer')
  return { appId, address: getApplicationAddress(appId).toString() }
}

export function algoToMicroAlgo(args: { algo: number }) {
  const { algo } = args
  if (typeof algo !== 'number' || !Number.isFinite(algo)) throw new Error('algo must be a finite number')
  if (algo < 0) throw new Error('algo must be non-negative')
  return { algo, microAlgo: Math.round(algo * 1_000_000) }
}

export function microAlgoToAlgo(args: { microAlgo: number }) {
  const { microAlgo } = args
  if (typeof microAlgo !== 'number' || !Number.isFinite(microAlgo)) throw new Error('microAlgo must be a finite number')
  if (microAlgo < 0) throw new Error('microAlgo must be non-negative')
  return { microAlgo, algo: microAlgo / 1_000_000 }
}

export function calculateMinBalance(args: {
  numAssets?: number
  numCreatedApps?: number
  numOptedInApps?: number
  numExtraAppPages?: number
  numBoxes?: number
  totalBoxBytes?: number
}) {
  const numAssets = args.numAssets ?? 0
  const numCreatedApps = args.numCreatedApps ?? 0
  const numOptedInApps = args.numOptedInApps ?? 0
  const numExtraAppPages = args.numExtraAppPages ?? 0
  const numBoxes = args.numBoxes ?? 0
  const totalBoxBytes = args.totalBoxBytes ?? 0

  const inputs = { numAssets, numCreatedApps, numOptedInApps, numExtraAppPages, numBoxes, totalBoxBytes }
  for (const [name, value] of Object.entries(inputs)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`)
    if (value < 0 || !Number.isInteger(value)) throw new Error(`${name} must be a non-negative integer`)
  }

  const breakdown = {
    base: BASE_MBR,
    assets: numAssets * ASSET_MBR,
    createdApps: numCreatedApps * APP_BASE_MBR + numExtraAppPages * APP_BASE_MBR,
    optedInApps: numOptedInApps * APP_OPTED_IN_MBR,
    boxes: numBoxes * BOX_FLAT_MBR + totalBoxBytes * BOX_BYTE_MBR,
  }

  const minBalanceMicroAlgo =
    breakdown.base + breakdown.assets + breakdown.createdApps + breakdown.optedInApps + breakdown.boxes

  return { minBalanceMicroAlgo, minBalanceAlgo: minBalanceMicroAlgo / 1_000_000, breakdown }
}
