const MICROUNIT = 1_000_000

/** Convert microunits to human-readable dollar amount */
export function microToDollars(micro: number): string {
  return `$${(micro / MICROUNIT).toFixed(2)}`
}

/** Convert microunits to human-readable share quantity */
export function microToShares(micro: number): number {
  return micro / MICROUNIT
}

/** Format a probability (0-1) as a cents price */
export function probToDollars(prob: number): string {
  return `$${prob.toFixed(2)}`
}
