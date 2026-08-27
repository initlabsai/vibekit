type IndexerAsset = InstanceType<typeof import('algosdk').indexerModels.Asset>

/** Formatted asset returned by handlers. */
export interface FormattedAsset {
  assetId: number
  name?: string
  unitName?: string
  totalSupply: string
  totalSupplyScaled: string
  totalSupplyApprox?: string
  decimals: number
  creator?: string
  manager?: string
  reserve?: string
  freeze?: string
  clawback?: string
  defaultFrozen?: boolean
  url?: string
}

/** Asset balance entry. Amount is raw base units; the page carries `decimals`. */
export interface AssetBalance {
  address: string
  amount: string
  isFrozen: boolean
}

/**
 * Raw base units scaled by decimals, exact, comma-grouped: 1500000000 @ 6 →
 * '1,500'. Models miscount bare zeros; grouped digits and the ≈word from
 * approxWords() are what they quote.
 */
export function scaleBaseUnits(raw: bigint | number | string, decimals: number): string {
  const digits = BigInt(raw).toString().padStart(decimals + 1, '0')
  const whole = decimals === 0 ? digits : digits.slice(0, -decimals)
  const fraction = decimals === 0 ? '' : digits.slice(-decimals).replace(/0+$/, '')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${grouped}.${fraction}` : grouped
}

const SCALE_WORDS = ['thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion'] as const

/**
 * A magnitude in words for a scaled decimal string: '1,500,000,000' → '≈1.5 billion'.
 * Values under one million (where nobody miscounts) return undefined.
 */
export function approxWords(scaled: string): string | undefined {
  const whole = scaled.split('.')[0]!.replace(/,/g, '')
  if (whole.length < 7) return undefined
  const group = Math.min(Math.floor((whole.length - 1) / 3), SCALE_WORDS.length)
  const lead = whole.slice(0, whole.length - group * 3)
  const decimal = whole[lead.length]
  return `≈${lead}${decimal === '0' || lead.length > 2 ? '' : `.${decimal}`} ${SCALE_WORDS[group - 1]}`
}

export function formatAsset(asset: IndexerAsset): FormattedAsset {
  const params = asset.params
  return {
    assetId: Number(asset.index),
    name: params.name,
    unitName: params.unitName,
    totalSupply: String(params.total),
    totalSupplyScaled: scaleBaseUnits(params.total, params.decimals),
    totalSupplyApprox: approxWords(scaleBaseUnits(params.total, params.decimals)),
    decimals: params.decimals,
    creator: params.creator ? String(params.creator) : undefined,
    manager: params.manager ? String(params.manager) : undefined,
    reserve: params.reserve ? String(params.reserve) : undefined,
    freeze: params.freeze ? String(params.freeze) : undefined,
    clawback: params.clawback ? String(params.clawback) : undefined,
    defaultFrozen: params.defaultFrozen,
    url: params.url,
  }
}
