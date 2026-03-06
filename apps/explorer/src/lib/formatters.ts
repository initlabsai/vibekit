export function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 3) return address
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

export function formatAlgos(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(amount)
}

export function formatTimestamp(unix: number): string {
  return new Date(unix * 1000).toLocaleString()
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

export function txTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    pay: 'Payment',
    axfer: 'Asset Transfer',
    acfg: 'Asset Config',
    afrz: 'Asset Freeze',
    appl: 'App Call',
    keyreg: 'Key Registration',
    stpf: 'State Proof',
  }
  return labels[type] ?? type
}

export function formatAssetAmount(rawAmount: string, decimals: number): string {
  const num = BigInt(rawAmount)
  if (decimals === 0) return formatNumber(Number(num))
  const divisor = BigInt(10 ** decimals)
  const whole = num / divisor
  const frac = num % divisor
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
  if (!fracStr) return formatNumber(Number(whole))
  return `${formatNumber(Number(whole))}.${fracStr}`
}
