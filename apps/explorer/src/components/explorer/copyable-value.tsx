'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { ReactNode } from 'react'

interface CopyableValueProps {
  value: string
  children: ReactNode
}

/** Wraps any content with a click-to-copy button. Copies `value` to clipboard. */
export function CopyableValue({ value, children }: CopyableValueProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 cursor-pointer hover:text-algo-teal transition-colors"
      title={`Copy ${value}`}
    >
      {children}
      {copied ? (
        <Check className="w-3 h-3 text-green-400 shrink-0" />
      ) : (
        <Copy className="w-3 h-3 opacity-40 shrink-0" />
      )}
    </button>
  )
}
