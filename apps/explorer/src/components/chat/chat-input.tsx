'use client'

import { useRef, useCallback } from 'react'
import { Search, Send, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatInputProps {
  input: string
  setInput: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
  isLoading: boolean
  onStop?: () => void
  placeholder?: string
  showSearchIcon?: boolean
}

export function ChatInput({
  input,
  setInput,
  onSubmit,
  isLoading,
  onStop,
  placeholder,
  showSearchIcon,
}: ChatInputProps) {
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
      <div className="relative flex-1">
        {showSearchIcon && (
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-algo-muted" />
        )}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'Ask anything...'}
          rows={1}
          disabled={isLoading}
          enterKeyHint="send"
          className={`w-full resize-none bg-algo-card border border-algo-border rounded-lg ${showSearchIcon ? 'pl-12' : 'pl-4'} pr-4 py-2.5 text-[16px] sm:text-sm sm:py-3 text-algo-text placeholder:text-algo-muted focus:outline-none focus:border-algo-teal disabled:opacity-50 disabled:cursor-not-allowed`}
        />
      </div>
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
