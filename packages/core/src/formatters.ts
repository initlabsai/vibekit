/** Format a raw integer asset amount with decimal places into a human-readable string. */
export function formatAssetAmount(rawAmount: string, decimals: number): string {
  const num = BigInt(rawAmount)
  if (decimals === 0) return Number(num).toLocaleString('en-US')
  const divisor = BigInt(10 ** decimals)
  const whole = num / divisor
  const frac = num % divisor
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
  if (!fracStr) return Number(whole).toLocaleString('en-US')
  return `${Number(whole).toLocaleString('en-US')}.${fracStr}`
}
