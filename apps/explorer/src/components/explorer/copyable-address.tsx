'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { truncateAddress } from '@/lib/formatters'

interface CopyableAddressProps {
  address: string
  chars?: number
}

export function CopyableAddress({ address, chars }: CopyableAddressProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 font-mono cursor-pointer hover:text-algo-teal transition-colors"
      title={address}
    >
      {truncateAddress(address, chars)}
      {copied ? (
        <Check className="w-3 h-3 text-green-400 shrink-0" />
      ) : (
        <Copy className="w-3 h-3 opacity-40 shrink-0" />
      )}
    </button>
  )
}
