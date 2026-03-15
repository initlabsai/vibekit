interface AssetLogoProps {
  src: string | null
  name?: string
  size?: number
}

export function AssetLogo({ src, name, size = 24 }: AssetLogoProps) {
  if (src) {
    return (
      <img src={src} alt={name ?? 'Asset'} width={size} height={size} className="rounded-full" />
    )
  }
  const letter = (name ?? '?')[0].toUpperCase()
  return (
    <div
      className="rounded-full bg-algo-dark flex items-center justify-center text-xs font-bold text-algo-muted"
      style={{ width: size, height: size }}
    >
      {letter}
    </div>
  )
}
