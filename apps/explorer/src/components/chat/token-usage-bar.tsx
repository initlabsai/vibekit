interface TokenUsageBarProps {
  usedTokens: number
  maxTokens: number
}

export function formatTokenCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

export function TokenUsageBar({ usedTokens, maxTokens }: TokenUsageBarProps) {
  const ratio = usedTokens > 0 ? Math.min(usedTokens / maxTokens, 1) : 0
  const color =
    ratio < 0.5
      ? 'bg-green-500'
      : ratio < 0.75
        ? 'bg-yellow-500'
        : 'bg-red-500'

  return (
    <div className="h-[2px] bg-algo-border">
      {ratio > 0 && (
        <div
          className={`h-full transition-all duration-500 ease-out ${color}`}
          style={{ width: `${ratio * 100}%` }}
        />
      )}
    </div>
  )
}
