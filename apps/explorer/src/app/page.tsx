'use client'

import { useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { ChatMessage } from '@/components/chat/chat-message'
import { ChatInput } from '@/components/chat/chat-input'
import { Search, TriangleAlert } from 'lucide-react'
import { useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TypingDots } from '@/components/chat/typing-dots'

const SUGGESTIONS = [
  'Show me the latest block',
  'Look up USDC asset info',
  'Look up the account vibekit.algo',
]

export default function Home() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, status, error, stop } = useChat()
  const bottomRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)
  const isLoading = status === 'submitted' || status === 'streaming'

  // Track whether user is near the bottom of the scroll area
  useEffect(() => {
    const viewport = bottomRef.current?.closest(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null
    if (!viewport) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport
      shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 100
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [])

  // Only auto-scroll if user hasn't scrolled up
  useEffect(() => {
    if (shouldAutoScroll.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    shouldAutoScroll.current = true
    sendMessage({ text: input })
    setInput('')
  }

  const handleLoadMore = (toolName: string, nextToken: string) => {
    sendMessage({
      text: `Load more results from the previous \`${toolName}\` query. Pagination token: \`${nextToken}\``,
    })
  }

  const hasMessages = messages.length > 0

  if (!hasMessages) {
    return (
      <div className="relative overflow-hidden flex flex-col items-center justify-center min-h-screen px-4 hero-grain hero-glow">
        <div className="max-w-2xl w-full space-y-8">
          <div className="text-center space-y-3">
            <h1 className="text-3xl sm:text-5xl font-bold text-algo-teal text-glow">
              <span className="font-mono">VibeKit</span> Explorer
            </h1>
            <p className="text-algo-muted/80 max-w-md mx-auto">The Agentic Explorer for Algorand</p>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-algo-muted" />
            <ChatInput
              input={input}
              setInput={setInput}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              onStop={stop}
              placeholder="Search the Algorand blockchain..."
            />
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                onClick={() => sendMessage({ text: suggestion })}
                className="cursor-pointer rounded-full border-algo-border text-algo-muted hover:border-algo-teal hover:text-algo-teal"
              >
                {suggestion}
              </Button>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-yellow-500/80">
            <TriangleAlert className="size-3.5 shrink-0" />
            <p>
              She&apos;s a 10 but she&apos;s in <span className="font-bold">early alpha</span>.{' '}
              <a
                href="https://github.com/gabrielkuettel/vibekit/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-algo-teal transition-colors"
              >
                Report issues
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b border-algo-border px-4 py-3">
        <h1 className="text-sm font-semibold text-algo-teal">
          <span className="font-mono">VibeKit</span> Explorer
        </h1>
      </header>
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-4 sm:px-4 sm:py-6 space-y-6">
          <div className="max-w-5xl mx-auto space-y-6">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onLoadMore={handleLoadMore}
                isLoading={isLoading}
              />
            ))}

            {isLoading && messages.at(-1)?.role === 'user' && (
              <div className="rounded-lg px-4 py-3">
                <TypingDots />
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <p className="font-medium">Something went wrong</p>
                <p className="text-red-400/70 mt-1">{error.message}</p>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>
      </ScrollArea>
      <div className="border-t border-algo-border px-3 py-3 sm:px-4 sm:py-4">
        <div className="max-w-5xl mx-auto space-y-2">
          <ChatInput
            input={input}
            setInput={setInput}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            onStop={stop}
          />
          <div className="flex items-center justify-center gap-2 text-xs text-yellow-500/80">
            <TriangleAlert className="size-3.5 shrink-0" />
            <p>
              She&apos;s a 10, but she&apos;s in <span className="font-bold">alpha</span>.{' '}
              <a
                href="https://github.com/gabrielkuettel/vibekit/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-algo-teal transition-colors"
              >
                Report issues
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
