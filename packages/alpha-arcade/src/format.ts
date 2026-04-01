const MICROUNIT = 1_000_000

/** Convert microunits to USD */
export function microToUsd(micro: number): number {
  return micro / MICROUNIT
}

/** Convert microunits to share quantity */
export function microToShares(micro: number): number {
  return micro / MICROUNIT
}
