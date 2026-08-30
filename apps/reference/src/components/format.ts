/** Display formatting for chain figures. Digit math, never floats: amounts survive display unchanged. */

const group = (whole: string) => whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** Base units → whole tokens with a trimmed fraction: 1234567 at 6 decimals → "1.234567". */
export function formatBaseUnits(value: string | number, decimals: number): string {
  const raw = String(value)
  if (!/^\d+$/.test(raw)) return raw
  if (decimals === 0) return group(raw.replace(/^0+(?=\d)/, ''))
  const digits = raw.padStart(decimals + 1, '0')
  const whole = group(digits.slice(0, -decimals).replace(/^0+(?=\d)/, ''))
  const fraction = digits.slice(-decimals).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

/** microALGO → ALGO, sign kept. */
export function formatMicroAlgos(value: string | number): string {
  const raw = String(value)
  const negative = raw.startsWith('-')
  const magnitude = formatBaseUnits(negative ? raw.slice(1) : raw, 6)
  return negative && magnitude !== '0' ? `-${magnitude}` : magnitude
}

/** An address or id for a narrow column: the ends, an ellipsis between. */
export function shorten(value: string, width = 12): string {
  if (value.length <= width) return value
  const half = Math.max(2, Math.floor((width - 1) / 2))
  return `${value.slice(0, half)}…${value.slice(-half)}`
}

/** A block's unix time as a local date-time. */
export function formatRoundTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString()
}
