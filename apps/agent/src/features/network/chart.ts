/** Geometry for the TPS line: evenly spaced points, scaled into a box with vertical padding. */
export function chartGeometry(values: ReadonlyArray<number>, width: number, height: number, pad = 6): { xs: number[]; ys: number[] } {
  if (values.length < 2) return { xs: [], ys: [] }
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const xs = values.map((_, i) => (i / (values.length - 1)) * width)
  const ys = values.map((v) => height - pad - ((v - min) / range) * (height - pad * 2))
  return { xs, ys }
}

/** `1.2B`, `9.6M`, `120K`, or the number to one decimal. */
export function compact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toFixed(1)
}
