'use client'

import { useRef, useCallback } from 'react'
import { Send } from 'lucide-react'

interface ChatInputProps {
  input: string
  setInput: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
  isLoading: boolean
  placeholder?: string
}

export function ChatInput({ input, setInput, onSubmit, isLoading, placeholder }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (input.trim() && !isLoading) {
          onSubmit(e as unknown as React.FormEvent)
        }
      }
    },
    [input, isLoading, onSubmit]
  )

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? 'Ask about the Algorand blockchain...'}
        rows={1}
        className="flex-1 resize-none bg-algo-card border border-algo-border rounded-lg px-4 py-3 text-sm text-algo-text placeholder:text-algo-muted focus:outline-none focus:border-algo-teal"
      />
      <button
        type="submit"
        disabled={!input.trim() || isLoading}
        className="p-3 rounded-lg bg-algo-teal text-algo-dark disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        <Send className="w-4 h-4" />
      </button>
    </form>
  )
}
