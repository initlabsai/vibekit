'use client'

import { useRef, useCallback } from 'react'
import { Send, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatInputProps {
  input: string
  setInput: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
  isLoading: boolean
  onStop?: () => void
  placeholder?: string
}

export function ChatInput({ input, setInput, onSubmit, isLoading, onStop, placeholder }: ChatInputProps) {
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
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? 'Ask about the Algorand blockchain...'}
        rows={1}
        disabled={isLoading}
        enterKeyHint="send"
        className="flex-1 resize-none bg-algo-card border border-algo-border rounded-lg pl-12 pr-4 py-2.5 text-[16px] sm:text-sm sm:py-3 text-algo-text placeholder:text-algo-muted focus:outline-none focus:border-algo-teal disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {isLoading ? (
        <Button
          type="button"
          size="icon"
          onClick={onStop}
          className="size-10 bg-red-500/80 text-white hover:bg-red-500 cursor-pointer"
        >
          <Square className="!size-4" />
        </Button>
      ) : (
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim()}
          className="size-10 bg-algo-teal text-algo-dark hover:bg-algo-teal/90 disabled:opacity-40"
        >
          <Send className="!size-5" />
        </Button>
      )}
    </form>
  )
}
