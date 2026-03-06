'use client'

import { useChat } from '@ai-sdk/react'
import { ChatMessage } from '@/components/chat/chat-message'
import { ChatInput } from '@/components/chat/chat-input'
import { Search } from 'lucide-react'
import { useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

const SUGGESTIONS = [
  'Show me the latest block',
  'Look up USDC asset info',
  'Show me recent application calls',
  'Look up the account gabe.algo',
  'Resolve the NFD gabe.algo',
]

export default function Home() {
  const { messages, input, setInput, handleSubmit, isLoading, error, append } = useChat()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const hasMessages = messages.length > 0

  if (!hasMessages) {
    return (
      <div className="relative overflow-hidden flex flex-col items-center justify-center min-h-screen px-4 hero-grain hero-glow">
        <div className="max-w-2xl w-full space-y-8">
          <div className="text-center space-y-3">
            <h1 className="text-5xl font-bold text-algo-teal text-glow">
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
              placeholder="Search the Algorand blockchain..."
            />
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                onClick={() => append({ role: 'user', content: suggestion })}
                className="cursor-pointer rounded-full border-algo-border text-algo-muted hover:border-algo-teal hover:text-algo-teal"
              >
                {suggestion}
              </Button>
            ))}
          </div>
          <p className="text-center text-xs text-algo-muted">
            Alpha release &mdash;{' '}
            <a
              href="https://github.com/gabrielkuettel/vibekit/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-algo-teal transition-colors"
            >
              report an issue
            </a>
          </p>
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
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="px-4 py-6 space-y-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <p className="font-medium">Something went wrong</p>
                <p className="text-red-400/70 mt-1">{error.message}</p>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
      <div className="border-t border-algo-border px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-2">
          <ChatInput
            input={input}
            setInput={setInput}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
          <p className="text-center text-xs text-algo-muted">
            Alpha release &mdash;{' '}
            <a
              href="https://github.com/gabrielkuettel/vibekit/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-algo-teal transition-colors"
            >
              report an issue
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
